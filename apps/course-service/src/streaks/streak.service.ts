import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStreak } from './entities/user-streak.entity';
import { getStreakColor } from './dto/streak-color.dto';

// เรียกใช้ฟังก์ชันนี้เพื่อคำนวณสีของ streak ตามจำนวนวันที่ต่อเนื่อง
const DAY_MS = 24 * 60 * 60 * 1000;

// ฟังก์ชันช่วยแปลงเวลาปัจจุบันเป็นเวลาเริ่มต้นของวันในเขตเวลา Bangkok (UTC+7) เพื่อใช้ในการคำนวณ streak
function startOfBangkokDay(date: Date): number {
  const offsetMs = 7 * 60 * 60 * 1000;
  const bangkokTime = new Date(date.getTime() + offsetMs);

  return Date.UTC(
    bangkokTime.getUTCFullYear(),
    bangkokTime.getUTCMonth(),
    bangkokTime.getUTCDate(),
  );
}

function isSameBangkokDay(a: Date, b: Date): boolean {
  return startOfBangkokDay(a) === startOfBangkokDay(b);
}

function diffDaysBangkok(a: Date, b: Date): number {
  return Math.floor((startOfBangkokDay(a) - startOfBangkokDay(b)) / DAY_MS);
}

@Injectable()
export class StreakService {
  constructor(
    @InjectRepository(UserStreak)
    private readonly streakRepository: Repository<UserStreak>,
  ) {}

  // ---------- Increment Streak ----------
  async bumpStreak(
    userId: string,
    now: Date = new Date(),
  ): Promise<UserStreak> {
    const streak = await this.ensureStreak(userId);

    if (streak.lastCompletedAt) {
      const gap = diffDaysBangkok(now, streak.lastCompletedAt);

      // gap >= 2 → reset
      if (gap >= 2) {
        streak.currentStreak = 0;
        streak.rewardShownAt = null;
      }

      // ถ้าทำวันนี้ไปแล้ว → ไม่ต้องเพิ่ม
      if (isSameBangkokDay(now, streak.lastCompletedAt)) {
        return streak;
      }
    }

    const nextCurrent = (streak.currentStreak ?? 0) + 1;

    streak.currentStreak = nextCurrent;
    streak.longestStreak = Math.max(streak.longestStreak ?? 0, nextCurrent);
    streak.lastCompletedAt = now;

    return this.streakRepository.save(streak);
  }

  // ---------- Get Streak Status ----------
  async getStreak(userId: string): Promise<{
    streak: UserStreak;
    color: ReturnType<typeof getStreakColor>;
    isReward: boolean;
    isFlameOn: boolean;
  }> {
    let streak = await this.ensureStreak(userId);
    const now = new Date();

    if (streak.lastCompletedAt) {
      const gap = diffDaysBangkok(now, streak.lastCompletedAt);

      // gap >= 2 → reset
      if (gap >= 2) {
        streak.currentStreak = 0;
        streak.rewardShownAt = null;
        streak = await this.streakRepository.save(streak);
      }
    }

    const isCompletedToday =
      !!streak.lastCompletedAt && isSameBangkokDay(streak.lastCompletedAt, now);

    const isReward =
      isCompletedToday &&
      (!streak.rewardShownAt || !isSameBangkokDay(streak.rewardShownAt, now));

    const isFlameOn = isCompletedToday;

    return {
      streak,
      color: getStreakColor(streak.currentStreak),
      isReward,
      isFlameOn,
    };
  }

  // ---------- Mark Reward Shown ----------
  async markRewardShown(userId: string): Promise<UserStreak> {
    const streak = await this.ensureStreak(userId);
    streak.rewardShownAt = new Date();
    return this.streakRepository.save(streak);
  }

  // ---------- Reset Streak (Testing Only) ----------
  // async resetStreak(userId: string): Promise<UserStreak> {
  //   const streak = await this.ensureStreak(userId);
  //   streak.currentStreak = 0;
  //   streak.lastCompletedAt = null;
  //   streak.rewardShownAt = null;
  //   return this.streakRepository.save(streak);
  // }

  // ---------- Ensure Streak Exists ----------
  private async ensureStreak(userId: string): Promise<UserStreak> {
    let streak = await this.streakRepository.findOne({
      where: { userId },
    });

    if (!streak) {
      await this.streakRepository.upsert(
        {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastCompletedAt: null,
          rewardShownAt: null,
        },
        ['userId'],
      );

      streak = await this.streakRepository.findOne({
        where: { userId },
      });
    }

    return streak!;
  }
}
