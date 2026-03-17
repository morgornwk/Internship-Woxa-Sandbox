import { QueryRunner, Repository } from 'typeorm';
import { RewardService } from './reward.service';
import { Reward } from './entities/rewards.entity';
import { RewardRedemption } from './entities/reward-redemption';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RewardStatusService } from './reward-status.service';
import { serializeReward } from './reward-response.util';

describe('RewardService', () => {
  let service: RewardService;
  let rewardRepo: Repository<Reward>;
  let redeemRepo: Repository<RewardRedemption>;
  let userXpRepo: Repository<UserXp>;

  const mockRewardStatusService = {
    syncExpiredRewards: jest.fn(),
    isExpired: jest.fn(),
    hasStarted: jest.fn(),
  };

  const mockManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const mockCompensationManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockRewardQueryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    manager: mockManager,
  } as unknown as QueryRunner;

  const mockCourseQueryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    manager: mockManager,
  } as unknown as QueryRunner;

  const mockCompensationQueryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    manager: mockCompensationManager,
  } as unknown as QueryRunner;

  const mockRewardDataSource = {
    createQueryRunner: jest
      .fn()
      .mockImplementationOnce(() => mockRewardQueryRunner)
      .mockImplementation(() => mockCompensationQueryRunner),
  };

  const mockCourseDataSource = {
    createQueryRunner: jest.fn(() => mockCourseQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardService,
        {
          provide: getRepositoryToken(Reward, 'reward'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RewardRedemption, 'reward'),
          useValue: {
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserXp, 'course'),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getDataSourceToken('reward'),
          useValue: mockRewardDataSource,
        },
        {
          provide: getDataSourceToken('course'),
          useValue: mockCourseDataSource,
        },
        {
          provide: RewardStatusService,
          useValue: mockRewardStatusService,
        },
      ],
    }).compile();

    service = module.get<RewardService>(RewardService);
    rewardRepo = module.get(getRepositoryToken(Reward, 'reward'));
    redeemRepo = module.get(getRepositoryToken(RewardRedemption, 'reward'));
    userXpRepo = module.get(getRepositoryToken(UserXp, 'course'));

    jest.clearAllMocks();
    mockRewardDataSource.createQueryRunner.mockReset();
    mockCourseDataSource.createQueryRunner.mockReset();
    mockRewardDataSource.createQueryRunner
      .mockImplementationOnce(() => mockRewardQueryRunner)
      .mockImplementationOnce(() => mockCompensationQueryRunner);
    mockCourseDataSource.createQueryRunner.mockImplementation(
      () => mockCourseQueryRunner,
    );
    mockRewardStatusService.syncExpiredRewards.mockResolvedValue(0);
    mockRewardStatusService.isExpired.mockReturnValue(false);
    mockRewardStatusService.hasStarted.mockReturnValue(true);
    mockCompensationManager.findOne.mockResolvedValue(null);
    mockCompensationManager.delete.mockResolvedValue({ affected: 0 });
    mockCompensationManager.save.mockResolvedValue({});
  });

  describe('getAllReward', () => {
    it('should return all rewards', async () => {
      const rewards = [
        { id: 1, required_points: 10, remain: 5, is_active: true },
        { id: 2, required_points: 20, remain: 10, is_active: false },
      ] as Reward[];
      jest.spyOn(rewardRepo, 'find').mockResolvedValue(rewards);

      const result = await service.getAllReward();

      expect(mockRewardStatusService.syncExpiredRewards).toHaveBeenCalled();
      expect(result).toEqual(rewards.map(serializeReward));
    });
  });

  describe('getDetailReward', () => {
    it('should throw if reward id invalid', async () => {
      await expect(service.getDetailReward('1', 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if reward not found', async () => {
      jest.spyOn(rewardRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDetailReward('1', 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return reward with isCanRedeem true', async () => {
      const reward = {
        id: 1,
        limit_per_user: 2,
        required_points: 10,
        remain: 5,
        is_active: true,
      } as Reward;

      jest.spyOn(rewardRepo, 'findOne').mockResolvedValue(reward);
      jest.spyOn(redeemRepo, 'count').mockResolvedValue(1);

      const result = await service.getDetailReward('1', 1);

      expect(mockRewardStatusService.syncExpiredRewards).toHaveBeenCalled();
      expect(result).toEqual({
        reward: serializeReward(reward),
        isCanRedeem: true,
      });
    });
  });

  describe('getRedeem', () => {
    it('should return empty array when user has no redemptions', async () => {
      jest.spyOn(redeemRepo, 'find').mockResolvedValue([]);

      const result = await service.getRedeem('user1');

      expect(mockRewardStatusService.syncExpiredRewards).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getUserTotalXp', () => {
    it('should return total xp', async () => {
      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '150' }),
      };

      jest.spyOn(userXpRepo, 'findOne').mockResolvedValue(null);

      jest
        .spyOn(userXpRepo, 'createQueryBuilder')
        .mockReturnValue(
          mockQB as Repository<UserXp>['createQueryBuilder'] extends () => infer T
            ? T
            : never,
        );

      const result = await service.getUserTotalXp('user1');

      expect(result).toBe(150);
    });
  });

  describe('redeemReward', () => {
    it('should redeem successfully', async () => {
      const reward: Partial<Reward> = {
        id: 1,
        is_active: true,
        required_points: 100,
        redeem_start_date: new Date(),
        redeem_end_date: new Date(Date.now() + 100000),
        remain: 5,
        total_limit: 10,
        limit_per_user: 2,
      };

      const userXp = {
        userId: 'user1',
        xpTotal: 200,
      } as UserXp;

      mockManager.findOne
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(userXp);

      mockManager.count.mockResolvedValue(0);
      mockManager.save.mockResolvedValue({});
      mockManager.create.mockReturnValue({ id: 1 });

      const result = await service.redeemReward('user1', 1);

      expect(result.message).toBe('Redeem success');
      expect(mockRewardQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockCourseQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw not found when reward does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(service.redeemReward('user1', 1)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockCourseQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRewardQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw not found when user xp record does not exist', async () => {
      const reward: Partial<Reward> = {
        id: 1,
        is_active: true,
        required_points: 100,
        redeem_start_date: new Date(),
        redeem_end_date: new Date(Date.now() + 100000),
        remain: 5,
        total_limit: 10,
        limit_per_user: 2,
      };

      mockManager.findOne
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(null);

      await expect(service.redeemReward('user1', 1)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockCourseQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRewardQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should compensate reward changes when course commit fails after reward commit', async () => {
      const reward: Partial<Reward> = {
        id: 1,
        is_active: true,
        required_points: 100,
        redeem_start_date: new Date(),
        redeem_end_date: new Date(Date.now() + 100000),
        remain: 5,
        total_limit: 10,
        limit_per_user: 2,
      };

      const userXp = {
        userId: 'user1',
        xpTotal: 200,
      } as UserXp;

      mockManager.findOne
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(userXp);
      mockManager.count.mockResolvedValue(0);
      mockManager.save.mockResolvedValue({});
      mockManager.create.mockReturnValue({ id: 1 });
      mockRewardDataSource.createQueryRunner
        .mockImplementationOnce(() => mockRewardQueryRunner)
        .mockImplementationOnce(() => mockCompensationQueryRunner);
      (
        mockCourseQueryRunner.commitTransaction as jest.Mock
      ).mockRejectedValueOnce(new Error('course commit failed'));

      mockCompensationManager.findOne.mockResolvedValueOnce({
        id: 1,
        remain: 4,
        total_limit: 10,
      });
      mockCompensationManager.delete.mockResolvedValueOnce({ affected: 1 });
      mockCompensationManager.save.mockResolvedValueOnce({});

      await expect(service.redeemReward('user1', 1)).rejects.toThrow(
        'Redeem failed during finalization and reward changes were compensated',
      );

      expect(mockRewardQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockCompensationQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockCompensationManager.delete).toHaveBeenCalled();
      expect(mockCompensationManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ remain: 5 }),
      );
    });

    it('should rollback if error occurs', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(service.redeemReward('user1', 1)).rejects.toThrow();

      expect(mockCourseQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRewardQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should deactivate expired reward during redeem validation', async () => {
      const expiredReward: Partial<Reward> = {
        id: 1,
        is_active: true,
        redeem_start_date: new Date(Date.now() - 60_000),
        redeem_end_date: new Date(Date.now() - 1_000),
      };

      mockRewardStatusService.isExpired.mockReturnValue(true);

      mockManager.findOne.mockResolvedValueOnce(expiredReward);

      await expect(service.redeemReward('user1', 1)).rejects.toThrow(
        new BadRequestException('Reward not in redeem period'),
      );

      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(mockCourseQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRewardQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject reward before redeem start date', async () => {
      const upcomingReward: Partial<Reward> = {
        id: 1,
        is_active: true,
        redeem_start_date: new Date('2026-03-13T00:48:00.000Z'),
        redeem_end_date: new Date('2026-03-31T01:18:00.000Z'),
      };

      mockRewardStatusService.hasStarted.mockReturnValue(false);
      mockManager.findOne.mockResolvedValueOnce(upcomingReward);

      await expect(service.redeemReward('user1', 1)).rejects.toThrow(
        new BadRequestException('Reward not in redeem period'),
      );

      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockCourseQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRewardQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
