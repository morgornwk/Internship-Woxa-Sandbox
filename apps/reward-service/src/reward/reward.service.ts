import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reward } from './entities/rewards.entity';
import { DataSource, QueryRunner, Raw, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { RewardRedemption } from './entities/reward-redemption';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';
import { randomUUID } from 'crypto';
import { RewardStatusService } from './reward-status.service';
import {
  serializeReward,
  serializeRewardRedemption,
} from './reward-response.util';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  constructor(
    @InjectDataSource('reward')
    private readonly rewardDataSource: DataSource,

    @InjectDataSource('course')
    private readonly courseDataSource: DataSource,

    @InjectRepository(Reward, 'reward')
    private readonly rewardRepository: Repository<Reward>,

    @InjectRepository(RewardRedemption, 'reward')
    private readonly redeemRepository: Repository<RewardRedemption>,

    @InjectRepository(UserXp, 'course')
    private readonly userxpRepository: Repository<UserXp>,

    private readonly rewardStatusService: RewardStatusService,
  ) {}

  async getAllReward() {
    await this.rewardStatusService.syncExpiredRewards();

    const rewards = await this.rewardRepository.find();
    return rewards.map(serializeReward);
  }

  async getDetailReward(userId: string, rewardId: number) {
    if (!rewardId || rewardId <= 0) {
      throw new BadRequestException('Invalid reward id');
    }

    await this.rewardStatusService.syncExpiredRewards();

    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId },
    });

    if (!reward) {
      throw new NotFoundException(`Reward with id ${rewardId} not found`);
    }

    const count = await this.redeemRepository.count({
      where: {
        userId,
        reward: { id: reward.id },
      },
    });

    let status = true;

    if (reward.limit_per_user !== null && count >= reward.limit_per_user) {
      status = false;
    }

    return { reward: serializeReward(reward), isCanRedeem: status };
  }

  async getRedeemCount(userId: string) {
    const count = await this.redeemRepository.count({
      where: {
        userId,
        isUsed: false,
        expire_at: Raw(
          (alias) => `${alias} > (NOW() AT TIME ZONE 'Asia/Bangkok')`,
        ),
      },
    });

    return { countUserRedeem: count };
  }

  async getRedeem(userId: string) {
    await this.rewardStatusService.syncExpiredRewards();

    const redeems = await this.redeemRepository.find({
      where: { userId },
      relations: ['reward'],
    });

    return redeems.map(serializeRewardRedemption);
  }

  async getUserTotalXp(userId: string): Promise<number> {
    // Return latest cumulative xpTotal if available, otherwise sum xpEarned as fallback
    const latest = await this.userxpRepository.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    if (latest && typeof latest.xpTotal === 'number') {
      return latest.xpTotal;
    }

    const raw = await this.userxpRepository
      .createQueryBuilder('ux')
      .select('COALESCE(SUM(ux.xpEarned), 0)', 'total')
      .where('ux.userId = :userId', { userId })
      .getRawOne<{ total: string }>();

    return Number(raw?.total ?? 0);
  }

  async redeemReward(userId: string, rewardId: number) {
    const rewardRunner = this.rewardDataSource.createQueryRunner();
    const courseRunner = this.courseDataSource.createQueryRunner();
    let rewardCommitted = false;

    await rewardRunner.connect();
    await courseRunner.connect();

    await rewardRunner.startTransaction();
    await courseRunner.startTransaction();

    try {
      const reward = await this.validateReward(rewardRunner, rewardId);

      const userXp = await this.validateUserXp(
        courseRunner,
        userId,
        reward.required_points,
      );

      await this.validateUserLimit(rewardRunner, userId, reward);
      userXp.xpTotal -= reward.required_points;
      await courseRunner.manager.save(userXp);

      const redeemToken = randomUUID();

      if (reward.total_limit != null && reward.remain != null) {
        reward.remain -= 1;
      }

      await rewardRunner.manager.save(reward);
      const redemption = rewardRunner.manager.create(RewardRedemption, {
        userId,
        reward,
        used_points: reward.required_points,
        expire_at: reward.redeem_end_date,
        redeem_token: redeemToken,
      });
      const savedRedemption = await rewardRunner.manager.save(redemption);
      await rewardRunner.commitTransaction();
      rewardCommitted = true;

      try {
        await courseRunner.commitTransaction();
      } catch (error) {
        this.logger.error(
          `Course transaction commit failed after reward commit: ${this.getErrorMessage(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.compensateRewardRedemption(reward.id, redeemToken);
        throw new InternalServerErrorException(
          'Redeem failed during finalization and reward changes were compensated',
        );
      }

      return {
        message: 'Redeem success',
        data: serializeRewardRedemption(savedRedemption),
      };
    } catch (error) {
      await this.safeRollback(courseRunner, 'course transaction');

      if (!rewardCommitted) {
        await this.safeRollback(rewardRunner, 'reward transaction');
      }

      throw error;
    } finally {
      await courseRunner.release();
      await rewardRunner.release();
    }
  }

  private async validateReward(
    runner: QueryRunner,
    rewardId: number,
  ): Promise<Reward> {
    const now = new Date();

    const reward = await runner.manager.findOne(Reward, {
      where: { id: rewardId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    if (!reward.is_active) {
      throw new BadRequestException('Reward is inactive');
    }

    if (this.rewardStatusService.isExpired(reward.redeem_end_date, now)) {
      reward.is_active = false;
      await runner.manager.save(reward);
      throw new BadRequestException('Reward not in redeem period');
    }

    if (!this.rewardStatusService.hasStarted(reward.redeem_start_date, now)) {
      throw new BadRequestException('Reward not in redeem period');
    }

    if (reward.remain <= 0 && reward.remain != null) {
      throw new BadRequestException('Reward out of stock');
    }

    return reward;
  }

  private async validateUserXp(
    runner: QueryRunner,
    userId: string,
    requiredPoints: number,
  ): Promise<UserXp> {
    // Lock the latest UserXp row for this user (we store cumulative xpTotal there)
    const user = await runner.manager.findOne(UserXp, {
      where: { userId },
      order: { updatedAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.xpTotal < requiredPoints) {
      throw new BadRequestException('Not enough points');
    }

    return user;
  }

  private async validateUserLimit(
    runner: QueryRunner,
    userId: string,
    reward: Reward,
  ) {
    if (reward.limit_per_user == null || reward.limit_per_user == 0) {
      return;
    }

    const count = await runner.manager.count(RewardRedemption, {
      where: {
        userId,
        reward: { id: reward.id },
      },
    });

    if (count >= reward.limit_per_user) {
      throw new BadRequestException('Redeem limit exceeded');
    }
  }

  private async safeRollback(
    runner: QueryRunner,
    context: string,
  ): Promise<void> {
    try {
      await runner.rollbackTransaction();
    } catch (error) {
      this.logger.warn(
        `Rollback failed for ${context}: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async compensateRewardRedemption(
    rewardId: number,
    redeemToken: string,
  ) {
    const compensationRunner = this.rewardDataSource.createQueryRunner();

    await compensationRunner.connect();
    await compensationRunner.startTransaction();

    try {
      const reward = await compensationRunner.manager.findOne(Reward, {
        where: { id: rewardId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reward) {
        throw new NotFoundException('Reward not found during compensation');
      }

      const deleteResult = await compensationRunner.manager.delete(
        RewardRedemption,
        {
          redeem_token: redeemToken,
        },
      );

      if (
        (deleteResult.affected ?? 0) > 0 &&
        reward.total_limit != null &&
        reward.remain != null
      ) {
        reward.remain += 1;
        await compensationRunner.manager.save(reward);
      }

      await compensationRunner.commitTransaction();
    } catch (error) {
      await this.safeRollback(
        compensationRunner,
        'reward compensation transaction',
      );
      this.logger.error(
        'Failed to compensate reward redemption after course commit failure',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Redeem failed after partial commit and compensation was unsuccessful',
      );
    } finally {
      await compensationRunner.release();
    }
  }
}
