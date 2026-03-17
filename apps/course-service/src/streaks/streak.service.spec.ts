import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { StreakService } from './streak.service';
import { UserStreak } from './entities/user-streak.entity';

describe('StreakService', () => {
  let service: StreakService;

  type UserStreakRepoMock = {
    findOne: jest.Mock;
    upsert: jest.Mock;
    save: jest.Mock;
  };

  let repo: UserStreakRepoMock;

  const makeStreak = (overrides: Partial<UserStreak> = {}): UserStreak =>
    ({
      userId: 'u1',
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedAt: null as any,
      rewardShownAt: null as any,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as UserStreak;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        {
          provide: getRepositoryToken(UserStreak),
          useValue: {
            findOne: jest.fn(),
            upsert: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(StreakService);
    repo = module.get(getRepositoryToken(UserStreak));
    jest.clearAllMocks();
  });

  describe('bumpStreak', () => {
    it('creates streak if missing then increments', async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeStreak())
        .mockResolvedValueOnce(makeStreak({ currentStreak: 1, longestStreak: 1 }));

      repo.save.mockImplementation(async (s) => s as any);

      const res = await service.bumpStreak('u1', new Date('2026-03-05T10:00:00.000Z'));

      expect(repo.upsert).toHaveBeenCalled();
      expect(res.currentStreak).toBe(1);
    });

    it('does not increment if already completed today', async () => {
      const now = new Date('2026-03-05T10:00:00.000Z');
      repo.findOne.mockResolvedValue(makeStreak({ currentStreak: 5, lastCompletedAt: now }));

      const res = await service.bumpStreak('u1', now);
      expect(res.currentStreak).toBe(5);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('resets when gap >= 2 days then increments', async () => {
      const last = new Date('2026-03-01T10:00:00.000Z');
      const now = new Date('2026-03-05T10:00:00.000Z');
      const streak = makeStreak({ currentStreak: 10, longestStreak: 10, lastCompletedAt: last, rewardShownAt: last });
      repo.findOne.mockResolvedValue(streak);
      repo.save.mockImplementation(async (s) => s as any);

      const res = await service.bumpStreak('u1', now);
      expect(res.currentStreak).toBe(1);
      expect(res.rewardShownAt).toBeNull();
    });

    it('increments when lastCompletedAt was yesterday (gap = 1)', async () => {
      const last = new Date('2026-03-04T10:00:00.000Z');
      const now = new Date('2026-03-05T10:00:00.000Z');
      const streak = makeStreak({ currentStreak: 2, longestStreak: 2, lastCompletedAt: last });
      repo.findOne.mockResolvedValue(streak);
      repo.save.mockImplementation(async (s) => s as any);

      const res = await service.bumpStreak('u1', now);

      expect(res.currentStreak).toBe(3);
      expect(res.longestStreak).toBe(3);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getStreak', () => {
    it('resets when gap >= 2 days', async () => {
      const last = new Date('2026-03-01T10:00:00.000Z');
      const streak = makeStreak({ currentStreak: 3, lastCompletedAt: last, rewardShownAt: last });
      repo.findOne.mockResolvedValue(streak);
      repo.save.mockImplementation(async (s) => s as any);

      const res = await service.getStreak('u1');
      expect(res.streak.currentStreak).toBe(0);
    });

    it('returns isReward true when completed today and not shown yet', async () => {
      const now = new Date();
      const streak = makeStreak({ currentStreak: 2, lastCompletedAt: now, rewardShownAt: null });
      repo.findOne.mockResolvedValue(streak);

      const res = await service.getStreak('u1');
      expect(res.isFlameOn).toBe(true);
      expect(res.isReward).toBe(true);
    });

    it('returns isReward false when reward already shown today', async () => {
      const now = new Date();
      const streak = makeStreak({ currentStreak: 2, lastCompletedAt: now, rewardShownAt: now });
      repo.findOne.mockResolvedValue(streak);

      const res = await service.getStreak('u1');
      expect(res.isFlameOn).toBe(true);
      expect(res.isReward).toBe(false);
    });

    it('returns isFlameOn false when not completed today (gap = 1)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-05T10:00:00.000Z'));
      const last = new Date('2026-03-04T10:00:00.000Z');
      const streak = makeStreak({ currentStreak: 2, lastCompletedAt: last, rewardShownAt: null });
      repo.findOne.mockResolvedValue(streak);

      const res = await service.getStreak('u1');
      expect(res.isFlameOn).toBe(false);
      expect(res.isReward).toBe(false);
      expect(res.streak.currentStreak).toBe(2);
      expect(repo.save).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('markRewardShown', () => {
    it('sets rewardShownAt and saves', async () => {
      const streak = makeStreak({ rewardShownAt: null });
      repo.findOne.mockResolvedValue(streak);
      repo.save.mockImplementation(async (s) => s as any);

      const res = await service.markRewardShown('u1');
      expect(res.rewardShownAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalled();
    });

    it('creates streak if missing then marks shown', async () => {
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeStreak())
        .mockResolvedValueOnce(makeStreak());

      repo.save.mockImplementation(async (s) => s as any);

      await service.markRewardShown('u1');
      expect(repo.upsert).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
