import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Reward } from './entities/rewards.entity';
import { compareStoredRewardTimestampToBangkokNow } from './reward-timestamp.util';

@Injectable()
export class RewardStatusService {
  private readonly logger = new Logger(RewardStatusService.name);

  constructor(
    @InjectRepository(Reward, 'reward')
    private readonly rewardRepository: Repository<Reward>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncExpiredRewards(): Promise<number> {
    const result = await this.rewardRepository
      .createQueryBuilder()
      .update(Reward)
      .set({ is_active: false })
      .where('is_active = :active', { active: true })
      .andWhere('redeem_end_date IS NOT NULL')
      .andWhere(`redeem_end_date < (NOW() AT TIME ZONE 'Asia/Bangkok')`)
      .execute();

    const affected = result.affected ?? 0;

    if (affected > 0) {
      this.logger.log(`Deactivated ${affected} expired reward(s)`);
    }

    return affected;
  }

  isExpired(
    redeemEndDate?: Date | string | null,
    now: Date = new Date(),
  ): boolean {
    if (!redeemEndDate) {
      return false;
    }

    const comparison = compareStoredRewardTimestampToBangkokNow(
      redeemEndDate,
      now,
    );

    return comparison !== null && comparison < 0;
  }

  hasStarted(
    redeemStartDate?: Date | string | null,
    now: Date = new Date(),
  ): boolean {
    if (!redeemStartDate) {
      return true;
    }

    const comparison = compareStoredRewardTimestampToBangkokNow(
      redeemStartDate,
      now,
    );

    return comparison !== null && comparison <= 0;
  }

  resolveActiveStatus(
    currentStatus: boolean | null | undefined,
    redeemEndDate?: Date | string | null,
    now: Date = new Date(),
  ): boolean {
    if (!currentStatus) {
      return false;
    }

    return !this.isExpired(redeemEndDate, now);
  }
}
