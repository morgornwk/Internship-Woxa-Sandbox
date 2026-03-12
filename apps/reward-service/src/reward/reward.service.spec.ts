import { QueryRunner, Repository } from "typeorm";
import { RewardService } from "./reward.service";
import { Reward } from "./entities/rewards.entity";
import { RewardRedemption } from "./entities/reward-redemption";
import { UserXp } from "apps/course-service/src/quizs/entities/user-xp.entity";
import { Test, TestingModule } from "@nestjs/testing";
import { getDataSourceToken, getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RewardStatusService } from "./reward-status.service";
import { serializeReward } from "./reward-response.util";

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
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    manager: mockManager,
  } as unknown as QueryRunner;

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
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
          useValue: mockDataSource,
        },
        {
          provide: getDataSourceToken('course'),
          useValue: mockDataSource,
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
    mockRewardStatusService.syncExpiredRewards.mockResolvedValue(0);
    mockRewardStatusService.isExpired.mockReturnValue(false);
    mockRewardStatusService.hasStarted.mockReturnValue(true);
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
      await expect(service.getDetailReward('1', 0))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw if reward not found', async () => {
      jest.spyOn(rewardRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDetailReward('1', 99))
        .rejects
        .toThrow(NotFoundException);
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
        .mockReturnValue(mockQB as any);

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


      (mockManager.findOne as jest.Mock)
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(userXp);

      (mockManager.count as jest.Mock).mockResolvedValue(0);
      (mockManager.save as jest.Mock).mockResolvedValue({});
      (mockManager.create as jest.Mock).mockReturnValue({ id: 1 });

      const result = await service.redeemReward('user1', 1);

      expect(result.message).toBe('Redeem success');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback if error occurs', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.redeemReward('user1', 1))
        .rejects
        .toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should deactivate expired reward during redeem validation', async () => {
      const expiredReward: Partial<Reward> = {
        id: 1,
        is_active: true,
        redeem_start_date: new Date(Date.now() - 60_000),
        redeem_end_date: new Date(Date.now() - 1_000),
      };

      mockRewardStatusService.isExpired.mockReturnValue(true);

      (mockManager.findOne as jest.Mock).mockResolvedValueOnce(expiredReward);

      await expect(service.redeemReward('user1', 1))
        .rejects
        .toThrow(new BadRequestException('Reward not in redeem period'));

      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject reward before redeem start date', async () => {
      const upcomingReward: Partial<Reward> = {
        id: 1,
        is_active: true,
        redeem_start_date: new Date('2026-03-13T00:48:00.000Z'),
        redeem_end_date: new Date('2026-03-31T01:18:00.000Z'),
      };

      mockRewardStatusService.hasStarted.mockReturnValue(false);
      (mockManager.findOne as jest.Mock).mockResolvedValueOnce(upcomingReward);

      await expect(service.redeemReward('user1', 1))
        .rejects
        .toThrow(new BadRequestException('Reward not in redeem period'));

      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});