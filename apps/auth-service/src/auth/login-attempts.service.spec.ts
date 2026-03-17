import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LoginAttemptsService } from './login-attempts.service';
import { LoginAttempt } from './entities/login-attempt.entity';

describe('LoginAttemptsService', () => {
  let service: LoginAttemptsService;

  type LoginAttemptRepoMock = {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let repo: LoginAttemptRepoMock;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAttemptsService,
        {
          provide: getRepositoryToken(LoginAttempt, 'auth'),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto) => ({ id: 'la-1', ...dto })),
            save: jest.fn(async (a) => a),
          },
        },
      ],
    }).compile();

    service = module.get(LoginAttemptsService);
    repo = module.get(getRepositoryToken(LoginAttempt, 'auth'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getLockStatus', () => {
    it('returns unlocked when no attempt exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getLockStatus('a@b.com')).resolves.toEqual({
        isLocked: false,
        lockedUntil: null,
        remainingMs: 0,
      });
    });

    it('returns locked when lockedUntil is in the future', async () => {
      const lockedUntil = new Date('2026-03-05T00:00:30.000Z');
      repo.findOne.mockResolvedValue({
        email: 'a@b.com',
        lockedUntil,
      });

      const result = await service.getLockStatus('a@b.com');
      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toEqual(lockedUntil);
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it('resets counters when lock expired', async () => {
      const attempt = {
        email: 'a@b.com',
        failedAttempts: 3,
        lastFailedAt: new Date('2026-03-04T00:00:00.000Z'),
        lockedUntil: new Date('2026-03-04T23:00:00.000Z'),
      };
      repo.findOne.mockResolvedValue(attempt);

      const result = await service.getLockStatus('a@b.com');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedAttempts: 0,
          lockedUntil: null,
          lastFailedAt: null,
        }),
      );
      expect(result.isLocked).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('creates attempt if missing and increments', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.recordFailure('a@b.com');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com', failedAttempts: 0 }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.isLocked).toBe(false);
    });

    it('respects active lock without saving', async () => {
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + 10_000);
      repo.findOne.mockResolvedValue({
        email: 'a@b.com',
        failedAttempts: 0,
        lastFailedAt: null,
        lockedUntil,
      });

      const result = await service.recordFailure('a@b.com');

      expect(repo.save).not.toHaveBeenCalled();
      expect(result.isLocked).toBe(true);
    });

    it('locks account after reaching max failed attempts', async () => {
      repo.findOne.mockResolvedValue({
        email: 'a@b.com',
        failedAttempts: 4,
        lastFailedAt: null,
        lockedUntil: null,
      });

      const result = await service.recordFailure('a@b.com');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lockedUntil: expect.any(Date),
          failedAttempts: 0,
        }),
      );
      expect(result.isLocked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });

  describe('resetAttempts', () => {
    it('no-ops when attempt does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.resetAttempts('a@b.com')).resolves.toBeUndefined();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('clears counters when attempt exists', async () => {
      const attempt = {
        email: 'a@b.com',
        failedAttempts: 2,
        lastFailedAt: new Date(),
        lockedUntil: new Date(),
      };
      repo.findOne.mockResolvedValue(attempt);

      await service.resetAttempts('a@b.com');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedAttempts: 0,
          lockedUntil: null,
          lastFailedAt: null,
        }),
      );
    });
  });
});
