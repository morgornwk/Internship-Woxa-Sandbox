import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RewardAdminService } from './reward-admin.service';
import { Reward } from '../reward/entities/rewards.entity';
import { RewardStatusService } from '../reward/reward-status.service';
import { AwsS3StorageService } from 'apps/course-service/src/storage/aws.service';

describe('RewardAdminService', () => {
  let service: RewardAdminService;

  const rewardRepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const rewardStatusServiceMock = {
    syncExpiredRewards: jest.fn(),
    resolveActiveStatus: jest.fn((currentStatus: boolean) => currentStatus),
  };

  const awsMock = {
    bucket: 'bucket',
    putObject: jest.fn(),
    buildPublicUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardAdminService,
        {
          provide: AwsS3StorageService,
          useValue: awsMock,
        },
        {
          provide: RewardStatusService,
          useValue: rewardStatusServiceMock,
        },
        {
          provide: getRepositoryToken(Reward, 'reward'),
          useValue: rewardRepoMock,
        },
      ],
    }).compile();

    service = module.get<RewardAdminService>(RewardAdminService);

    jest.clearAllMocks();
    rewardStatusServiceMock.resolveActiveStatus.mockImplementation((currentStatus: boolean) => currentStatus);
    rewardRepoMock.create.mockImplementation((value: any) => value);
    rewardRepoMock.save.mockImplementation(async (value: any) => value);
  });

  it('normalizes createReward UTC input into Bangkok wall-clock before saving', async () => {
    await service.createReward(
      {
        name: 'Reward',
        description: 'Desc',
        required_points: 100,
        redeem_start_date: '2026-03-13T00:09:00.000Z' as any,
        redeem_end_date: '2026-03-13T06:00:00.000Z' as any,
        limit_per_user: 1,
        total_limit: 10,
        is_active: true,
      },
      'https://example.com/reward.png',
    );

    expect(rewardRepoMock.create).toHaveBeenCalledWith(expect.objectContaining({
      redeem_start_date: new Date('2026-03-13T07:09:00.000Z'),
      redeem_end_date: new Date('2026-03-13T13:00:00.000Z'),
    }));
  });

  it('normalizes updateReward UTC input into Bangkok wall-clock before saving', async () => {
    rewardStatusServiceMock.syncExpiredRewards.mockResolvedValue(0);
    rewardRepoMock.findOne.mockResolvedValue({
      id: 1,
      name: 'Reward',
      description: 'Desc',
      required_points: 100,
      redeem_start_date: new Date('2026-03-13T07:09:00.000Z'),
      redeem_end_date: new Date('2026-03-13T13:00:00.000Z'),
      limit_per_user: 1,
      total_limit: 10,
      remain: 10,
      image_url: 'https://example.com/reward.png',
      is_active: true,
    });

    await service.updateReward(1, {
      redeem_start_date: '2026-03-12T15:47:00.000Z' as any,
      redeem_end_date: '2026-03-12T15:50:00.000Z' as any,
    } as any, undefined);

    expect(rewardRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({
      redeem_start_date: new Date('2026-03-12T22:47:00.000Z'),
      redeem_end_date: new Date('2026-03-12T22:50:00.000Z'),
    }));
  });
});