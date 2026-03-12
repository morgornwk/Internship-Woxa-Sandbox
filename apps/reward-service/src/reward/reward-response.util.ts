import { RewardRedemption } from './entities/reward-redemption';
import { Reward } from './entities/rewards.entity';
import { formatStoredRewardTimestamp } from './reward-timestamp.util';

const bangkokFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatBangkokTimestamp(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = bangkokFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    return parts.find((part) => part.type === type)?.value ?? '';
  };

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}.${pad(date.getUTCMilliseconds(), 3)}+07:00`;
}

function formatDateToBangkokWallClock(date: Date): string | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = bangkokFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    return parts.find((part) => part.type === type)?.value ?? '';
  };

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}.${pad(date.getUTCMilliseconds(), 3)}+07:00`;
}

function formatStoredTimestamp(value?: Date | string | null): string | null {
  return formatStoredRewardTimestamp(value);
}

export function serializeReward(reward: Reward) {
  return {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    remain: toNumberOrNull(reward.remain),
    image_url: reward.image_url,
    required_points: toNumberOrNull(reward.required_points),
    redeem_start_date: formatStoredTimestamp(reward.redeem_start_date),
    redeem_end_date: formatStoredTimestamp(reward.redeem_end_date),
    limit_per_user: reward.limit_per_user ?? null,
    total_limit: reward.total_limit ?? null,
    is_active: reward.is_active,
    created_at: formatBangkokTimestamp(reward.created_at),
    updated_at: formatBangkokTimestamp(reward.updated_at),
    delete_at: formatBangkokTimestamp(reward.delete_at),
  };
}

export function serializeRewardRedemption(redemption: RewardRedemption) {
  return {
    id: redemption.id,
    userId: redemption.userId,
    reward: redemption.reward ? serializeReward(redemption.reward) : null,
    used_points: toNumberOrNull(redemption.used_points),
    expire_at: formatStoredTimestamp(redemption.expire_at),
    redeem_token: redemption.redeem_token,
    isUsed: redemption.isUsed,
    redeemed_at: formatBangkokTimestamp(redemption.redeemed_at),
    created_at: formatBangkokTimestamp(redemption.created_at),
    updated_at: formatBangkokTimestamp(redemption.updated_at),
    delete_at: formatBangkokTimestamp(redemption.delete_at),
  };
}