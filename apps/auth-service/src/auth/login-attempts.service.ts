import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttempt } from './entities/login-attempt.entity';

type LockStatus = {
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingMs: number;
};

@Injectable()
export class LoginAttemptsService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCK_DURATION_MS = 60 * 1000; // 1 minute

  constructor(
    @InjectRepository(LoginAttempt, 'auth')
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
  ) {}

  async getLockStatus(email: string): Promise<LockStatus> {
    const attempt = await this.loginAttemptRepository.findOne({
      where: { email },
    });

    if (!attempt?.lockedUntil) {
      return { isLocked: false, lockedUntil: null, remainingMs: 0 };
    }

    const now = new Date();
    if (attempt.lockedUntil > now) {
      return {
        isLocked: true,
        lockedUntil: attempt.lockedUntil,
        remainingMs: attempt.lockedUntil.getTime() - now.getTime(),
      };
    }

    // Lock has expired, reset counters
    attempt.lockedUntil = null;
    attempt.failedAttempts = 0;
    attempt.lastFailedAt = null;
    await this.loginAttemptRepository.save(attempt);

    return { isLocked: false, lockedUntil: null, remainingMs: 0 };
  }

  async recordFailure(email: string): Promise<LockStatus> {
    const now = new Date();
    const attempt =
      (await this.loginAttemptRepository.findOne({ where: { email } })) ??
      this.loginAttemptRepository.create({
        email,
        failedAttempts: 0,
        lastFailedAt: null,
        lockedUntil: null,
      });

    // Respect active lock if still in effect
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return {
        isLocked: true,
        lockedUntil: attempt.lockedUntil,
        remainingMs: attempt.lockedUntil.getTime() - now.getTime(),
      };
    }

    attempt.failedAttempts += 1;
    attempt.lastFailedAt = now;

    if (attempt.failedAttempts >= LoginAttemptsService.MAX_FAILED_ATTEMPTS) {
      attempt.lockedUntil = new Date(
        now.getTime() + LoginAttemptsService.LOCK_DURATION_MS,
      );
      attempt.failedAttempts = 0;
    }

    await this.loginAttemptRepository.save(attempt);

    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return {
        isLocked: true,
        lockedUntil: attempt.lockedUntil,
        remainingMs: attempt.lockedUntil.getTime() - now.getTime(),
      };
    }

    return { isLocked: false, lockedUntil: null, remainingMs: 0 };
  }

  async resetAttempts(email: string): Promise<void> {
    const attempt = await this.loginAttemptRepository.findOne({
      where: { email },
    });
    if (!attempt) {
      return;
    }

    attempt.failedAttempts = 0;
    attempt.lockedUntil = null;
    attempt.lastFailedAt = null;
    await this.loginAttemptRepository.save(attempt);
  }
}
