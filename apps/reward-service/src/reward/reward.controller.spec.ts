import { Test, TestingModule } from '@nestjs/testing';
import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';

const mockReward = {
  id: 1,
  name: 'Reward',
  description: 'Desc',
  remain: 1,
  image_url: 'https://example.com/reward.png',
  required_points: 100,
  redeem_start_date: null,
  redeem_end_date: null,
  limit_per_user: 1,
  total_limit: 10,
  is_active: true,
  created_at: null,
  updated_at: null,
  delete_at: null,
};

const mockRedemption = {
  id: 1,
  userId: 'uuid-1',
  reward: mockReward,
  used_points: 100,
  expire_at: null,
  redeem_token: 'token-1',
  isUsed: false,
  redeemed_at: null,
  created_at: null,
  updated_at: null,
  delete_at: null,
};

describe('RewardController', () => {
  let controller: RewardController;
  let service: RewardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RewardController],
      providers: [
        {
          provide: RewardService,
          useValue: {
            getAllReward: jest.fn(),
            getDetailReward: jest.fn(),
            redeemReward: jest.fn(),
            getRedeem: jest.fn(),
            getUserTotalXp: jest.fn(),
            getRedeemCount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RewardController>(RewardController);
    service = module.get<RewardService>(RewardService);
  });

  it('should call redeemReward', async () => {
    jest.spyOn(service, 'redeemReward').mockResolvedValue({
      message: 'Redeem success',
      data: mockRedemption,
    });

    const result = await controller.redeemReward('uuid-1', 1);

    expect(result).toEqual({
      message: 'Redeem success',
      data: mockRedemption,
    });
    expect(service.redeemReward).toHaveBeenCalledWith('uuid-1', 1);
  });

  it('should call getAllReward', async () => {
    jest.spyOn(service, 'getAllReward').mockResolvedValue([mockReward]);

    const result = await controller.getAllReward();

    expect(result).toEqual([mockReward]);
    expect(service.getAllReward).toHaveBeenCalled();
  });

  it('should call getRewardDetail', async () => {
    jest.spyOn(service, 'getDetailReward').mockResolvedValue({
      reward: mockReward,
      isCanRedeem: true,
    });

    const result = await controller.getRewardDetail(1, 'uuid-1');

    expect(result).toEqual({ reward: mockReward, isCanRedeem: true });
    expect(service.getDetailReward).toHaveBeenCalledWith('uuid-1', 1);
  });

  it('should call getRedeem', async () => {
    jest.spyOn(service, 'getRedeem').mockResolvedValue([mockRedemption]);

    const result = await controller.getRedeem('uuid-1');

    expect(result).toEqual([mockRedemption]);
    expect(service.getRedeem).toHaveBeenCalledWith('uuid-1');
  });

  it('should call getUserTotalXp', async () => {
    jest.spyOn(service, 'getUserTotalXp').mockResolvedValue(100);

    const result = await controller.getUserTotalXp('uuid-1');

    expect(result).toBe(100);
    expect(service.getUserTotalXp).toHaveBeenCalledWith('uuid-1');
  });

  it('should call getCouponCount', async () => {
    jest
      .spyOn(service, 'getRedeemCount')
      .mockResolvedValue({ countUserRedeem: 2 });

    const result = await controller.getCouponCount('uuid-1');

    expect(result).toEqual({ countUserRedeem: 2 });
    expect(service.getRedeemCount).toHaveBeenCalledWith('uuid-1');
  });
});
