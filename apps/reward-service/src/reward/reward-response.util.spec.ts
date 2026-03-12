import { serializeReward, serializeRewardRedemption } from './reward-response.util';
import { Reward } from './entities/rewards.entity';
import { RewardRedemption } from './entities/reward-redemption';

describe('reward-response.util', () => {
  it('keeps redeem_start_date wall-clock time as 15:47+07:00 instead of shifting to 22:47', () => {
    const reward = {
      id: 1,
      name: 'Reward',
      description: 'Desc',
      remain: 10,
      image_url: 'https://example.com/reward.png',
      required_points: 100,
      redeem_start_date: new Date('2026-03-12T15:47:00.000Z'),
      redeem_end_date: new Date('2026-03-12T15:50:00.000Z'),
      limit_per_user: 1,
      total_limit: 10,
      is_active: true,
      created_at: new Date('2026-03-12T01:28:18.805Z'),
      updated_at: new Date('2026-03-12T01:48:02.771Z'),
      delete_at: null,
    } as unknown as Reward;

    const serialized = serializeReward(reward);

    expect(serialized.redeem_start_date).toBe('2026-03-12T15:47:00.000+07:00');
    expect(serialized.redeem_end_date).toBe('2026-03-12T15:50:00.000+07:00');
    expect(serialized.redeem_start_date).not.toBe('2026-03-12T22:47:00.000+07:00');
  });

  it('keeps expire_at wall-clock time as stored when serializing redemptions', () => {
    const redemption = {
      id: 7,
      userId: '4b7f5f7f-4d8b-4b34-8e61-c7c70d8ec001',
      reward: null,
      used_points: 50,
      expire_at: new Date('2026-03-12T15:47:00.000Z'),
      redeem_token: 'token-123',
      isUsed: false,
      redeemed_at: new Date('2026-03-12T01:28:18.805Z'),
      created_at: new Date('2026-03-12T01:28:18.805Z'),
      updated_at: new Date('2026-03-12T01:48:02.771Z'),
      delete_at: null,
    } as unknown as RewardRedemption;

    const serialized = serializeRewardRedemption(redemption);

    expect(serialized.expire_at).toBe('2026-03-12T15:47:00.000+07:00');
    expect(serialized.expire_at).not.toBe('2026-03-12T22:47:00.000+07:00');
  });
});