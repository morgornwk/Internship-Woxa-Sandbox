import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProgressService } from './progress.service';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import {
  LessonProgress,
  LessonProgressStatus,
} from './entities/progress.entity';
import { StreakService } from '../streaks/streak.service';
import { QuizService } from '../quizs/quiz.service';
import { RedisCacheService } from '../cache/redis-cache.service';

describe('ProgressService', () => {
  let service: ProgressService;

  type ProgressRepoMock = {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  type LessonRepoMock = {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  type ChapterRepoMock = {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  type StreakServiceMock = {
    bumpStreak: jest.Mock;
    getStreak: jest.Mock;
  };

  type QuizServiceMock = {
    skipCheckpointsByLesson: jest.Mock;
  };

  type RedisCacheServiceMock = {
    deleteByPrefix: jest.Mock;
  };

  let progressRepo: ProgressRepoMock;
  let lessonRepo: LessonRepoMock;
  let chapterRepo: ChapterRepoMock;
  let streakService: StreakServiceMock;
  let quizService: QuizServiceMock;
  let redisCacheService: RedisCacheServiceMock;

  const makeLesson = (overrides: Partial<Lesson> = {}): Lesson =>
    ({
      lesson_id: 10,
      chapter_id: 1,
      lesson_title: 'L',
      lesson_type: 'article' as any,
      isPublished: true,
      orderIndex: 1,
      ...overrides,
    }) as Lesson;

  const makeChapter = (overrides: Partial<Chapter> = {}): Chapter =>
    ({
      chapter_id: 1,
      levelId: 2,
      chapter_title: 'Ch',
      chapter_orderIndex: 1,
      ...overrides,
    }) as Chapter;

  const makeProgress = (
    overrides: Partial<LessonProgress> = {},
  ): LessonProgress =>
    ({
      id: 1,
      userId: 'u1',
      lessonId: 10,
      status: LessonProgressStatus.IN_PROGRESS,
      progressPercent: 0,
      positionSeconds: null as any,
      durationSeconds: null as any,
      mapLessonId: null as any,
      lastViewedAt: null as any,
      completedAt: null as any,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as LessonProgress;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: getRepositoryToken(LessonProgress),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((x: any) => x),
            save: jest.fn(async (x: any) => x),
          },
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Chapter),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: StreakService,
          useValue: {
            bumpStreak: jest.fn(),
            getStreak: jest.fn(),
          },
        },
        {
          provide: QuizService,
          useValue: {
            skipCheckpointsByLesson: jest.fn(),
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            deleteByPrefix: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ProgressService);
    progressRepo = module.get(getRepositoryToken(LessonProgress));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    chapterRepo = module.get(getRepositoryToken(Chapter));
    streakService = module.get(StreakService);
    quizService = module.get(QuizService);
    redisCacheService = module.get(RedisCacheService);

    jest.clearAllMocks();
  });

  describe('getAllLessonProgress', () => {
    it('returns [] when no rows', async () => {
      progressRepo.find.mockResolvedValue([]);
      const res = await service.getAllLessonProgress('u1');
      expect(res).toEqual([]);
    });

    it('maps rows to DTO with chapterId/levelId', async () => {
      progressRepo.find.mockResolvedValue([makeProgress({ lessonId: 10 })]);
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 10, chapter_id: 1 }),
      ] as any);
      chapterRepo.find.mockResolvedValue([
        makeChapter({ chapter_id: 1, levelId: 2 }),
      ] as any);

      const res = await service.getAllLessonProgress('u1');
      expect(res[0].lessonId).toBe(10);
      expect(res[0].chapterId).toBe(1);
      expect(res[0].levelId).toBe(2);
    });

    it('returns DTO with null chapterId/levelId when lesson lookup missing', async () => {
      progressRepo.find.mockResolvedValue([makeProgress({ lessonId: 999 })]);
      lessonRepo.find.mockResolvedValue([] as any);

      const res = await service.getAllLessonProgress('u1');
      expect(res[0].lessonId).toBe(999);
      expect(res[0].chapterId).toBeNull();
      expect(res[0].levelId).toBeNull();
    });
  });

  describe('getLessonProgress', () => {
    it('throws when lesson not found', async () => {
      lessonRepo.findOne.mockResolvedValue(null);
      await expect(service.getLessonProgress('u1', 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when progress row not found', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(null);
      await expect(service.getLessonProgress('u1', 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns DTO with levelId', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({ lessonId: 10, userId: 'u1' }),
      );
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 99 }) as any,
      );

      const res = (await service.getLessonProgress('u1', 10))!;
      expect(res.levelId).toBe(99);
    });
  });

  describe('upsertLessonProgress', () => {
    it('creates new progress and unlocks next lesson when completed', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      const progressByLessonId = new Map<number, LessonProgress | null>();
      progressByLessonId.set(10, null);
      progressByLessonId.set(
        11,
        makeProgress({
          lessonId: 11,
          userId: 'u1',
          status: LessonProgressStatus.LOCKED,
          mapLessonId: null,
        }),
      );

      progressRepo.findOne.mockImplementation(async (args: any) => {
        const lid = args?.where?.lessonId;
        return (progressByLessonId.get(lid) ?? null) as any;
      });

      progressRepo.save.mockImplementation(async (x: any) => {
        if (x.lessonId === 10) {
          x.status = LessonProgressStatus.COMPLETED;
          x.progressPercent = 100;
          x.completedAt = x.completedAt ?? new Date('2026-03-05T01:00:00.000Z');
        }
        progressByLessonId.set(x.lessonId, x);
        return x;
      });

      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.upsertLessonProgress('u1', 10, {
        markCompleted: true,
      } as any);

      expect(res.status).toBe(LessonProgressStatus.COMPLETED);
      expect(streakService.bumpStreak).toHaveBeenCalled();

      const nextProgress = progressByLessonId.get(11)!;
      expect(nextProgress.mapLessonId).toBe(10);
      expect(nextProgress.status).toBe(LessonProgressStatus.IN_PROGRESS);
    });

    it('throws when trying to change status of completed lesson', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.COMPLETED,
        }),
      );

      await expect(
        service.upsertLessonProgress('u1', 10, {
          status: LessonProgressStatus.IN_PROGRESS,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps progressPercent=100 for completed lessons even if dto tries to change it', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.COMPLETED,
          progressPercent: 80,
        }),
      );

      // allow the "no next lesson" path to run without unlocking next chapter
      lessonRepo.find.mockResolvedValue([lesson] as any);
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.COMPLETED,
          progressPercent: 80,
        }),
      ]);

      chapterRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.chapter_id === 1)
          return makeChapter({
            chapter_id: 1,
            levelId: 2,
            chapter_orderIndex: 1,
          }) as any;
        // nextChapter lookup
        if (args?.where?.levelId) return null;
        return null;
      });

      const res = await service.upsertLessonProgress('u1', 10, {
        progressPercent: 20,
      } as any);
      expect(res.status).toBe(LessonProgressStatus.COMPLETED);
      expect(res.progressPercent).toBe(100);
    });

    it('clamps and rounds progressPercent to 0..100', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
      // no next lesson
      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10)
          return makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 });
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.upsertLessonProgress('u1', 10, {
        progressPercent: 1000,
      } as any);
      expect(res.progressPercent).toBe(100);

      const res2 = await service.upsertLessonProgress('u1', 10, {
        progressPercent: -10.2,
      } as any);
      expect(res2.progressPercent).toBe(0);
    });

    it('infers progressPercent from positionSeconds/durationSeconds when not provided', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
      // no next lesson
      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10)
          return makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 });
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.upsertLessonProgress('u1', 10, {
        positionSeconds: 50,
        durationSeconds: 200,
      } as any);

      expect(res.progressPercent).toBe(25);
    });

    it('does not bump streak when already completed/skipped before', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.SKIPPED,
          progressPercent: 100,
        }),
      );

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10)
          return makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 });
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });
      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      await service.upsertLessonProgress('u1', 10, {
        markCompleted: true,
      } as any);
      expect(streakService.bumpStreak).not.toHaveBeenCalled();
    });

    it('unlocks first lesson of next chapter when this chapter completes and no next lesson', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });
      const currentChapter = makeChapter({
        chapter_id: 1,
        levelId: 2,
        chapter_orderIndex: 1,
      });
      const nextChapter = makeChapter({
        chapter_id: 2,
        levelId: 2,
        chapter_orderIndex: 2,
      });
      const firstNext = makeLesson({
        lesson_id: 20,
        chapter_id: 2,
        orderIndex: 1,
      });

      // lesson lookups: current, nextLesson in same chapter (none), first lesson in next chapter
      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null; // no next lesson
        if (args?.where?.chapter_id === 2 && args?.order) return firstNext;
        return null;
      });

      // chapter lookups: currentChapter, nextChapter
      chapterRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.chapter_id === 1) return currentChapter;
        if (args?.where?.levelId === 2 && args?.where?.chapter_orderIndex)
          return nextChapter;
        return null;
      });

      // progress: current missing, nextChapter first lesson missing
      progressRepo.findOne.mockResolvedValue(null);

      // isChapterCompletedForUser internals
      lessonRepo.find.mockResolvedValue([
        { lesson_id: 10, chapter_id: 1, orderIndex: 1 },
      ] as any);
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.COMPLETED,
        }),
      ]);

      // save should just echo
      progressRepo.save.mockImplementation(async (x: any) => x);

      const res = await service.upsertLessonProgress('u1', 10, {
        markCompleted: true,
      } as any);

      expect(res.status).toBe(LessonProgressStatus.COMPLETED);
      expect(progressRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lessonId: 20,
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
    });

    it('handles positionSeconds and durationSeconds updates correctly', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockResolvedValue(lesson as any);
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
          positionSeconds: 30,
          durationSeconds: 100,
        }),
      );

      // No next lesson scenarios
      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.upsertLessonProgress('u1', 10, {
        positionSeconds: 75,
        durationSeconds: 150,
      } as any);

      expect(res.positionSeconds).toBe(75);
      expect(res.durationSeconds).toBe(150);
      expect(res.lastViewedAt).toBeInstanceOf(Date);
    });

    it('sets completedAt when marking lesson as completed', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockResolvedValue(lesson as any);
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
          completedAt: null,
        }),
      );

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const beforeDate = new Date();
      const res = await service.upsertLessonProgress('u1', 10, {
        markCompleted: true,
      } as any);
      const afterDate = new Date();

      expect(res.status).toBe(LessonProgressStatus.COMPLETED);
      expect(res.progressPercent).toBe(100);
      expect(res.completedAt).toBeInstanceOf(Date);
      expect(res.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(res.completedAt!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('handles SKIPPED status correctly with completedAt timestamp', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockResolvedValue(lesson as any);
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
          completedAt: null,
        }),
      );

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const beforeDate = new Date();
      const res = await service.upsertLessonProgress('u1', 10, {
        status: LessonProgressStatus.SKIPPED,
      } as any);
      const afterDate = new Date();

      expect(res.status).toBe(LessonProgressStatus.SKIPPED);
      expect(res.progressPercent).toBe(100);
      expect(res.completedAt).toBeInstanceOf(Date);
      expect(res.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(res.completedAt!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('preserves existing completedAt when updating already completed lesson', async () => {
      const existingCompletedAt = new Date('2026-03-01T10:00:00.000Z');
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockResolvedValue(lesson as any);
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.COMPLETED,
          completedAt: existingCompletedAt,
        }),
      );

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.upsertLessonProgress('u1', 10, {
        positionSeconds: 50,
      } as any);

      expect(res.status).toBe(LessonProgressStatus.COMPLETED);
      expect(res.completedAt).toEqual(existingCompletedAt);
    });
  });

  describe('skipLessonAndUnlockNext', () => {
    it('throws when lesson not found', async () => {
      lessonRepo.findOne.mockResolvedValue(null);
      await expect(
        service.skipLessonAndUnlockNext('u1', 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('skips checkpoint lesson and calls quizService.skipCheckpointsByLesson', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
        lesson_type: 'checkpoint' as any,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => x);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.skipLessonAndUnlockNext('u1', 10);

      expect(quizService.skipCheckpointsByLesson).toHaveBeenCalledWith(
        10,
        'u1',
      );
      expect(res.skipped.status).toBe(LessonProgressStatus.SKIPPED);
      expect(res.unlockedNext?.lessonId).toBe(11);
    });

    it('throws when trying to skip completed lesson', async () => {
      lessonRepo.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1 }) as any,
      );
      progressRepo.findOne.mockResolvedValue(
        makeProgress({ status: LessonProgressStatus.COMPLETED }),
      );

      await expect(
        service.skipLessonAndUnlockNext('u1', 10),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('unlocks next lesson in same chapter when skipping current lesson', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      // Current lesson progress doesn't exist yet
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => {
        if (x.lessonId === 10) {
          x.status = LessonProgressStatus.SKIPPED;
          x.progressPercent = 100;
          x.completedAt = new Date();
        }
        return x;
      });

      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.skipLessonAndUnlockNext('u1', 10);

      expect(res.skipped.status).toBe(LessonProgressStatus.SKIPPED);
      expect(res.skipped.progressPercent).toBe(100);
      expect(res.unlockedNext?.lessonId).toBe(11);
      expect(res.unlockedNext?.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(streakService.bumpStreak).toHaveBeenCalled();
    });

    it('unlocks first lesson of next chapter when current chapter is completed after skip', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 2, // Last lesson in chapter
      });
      const currentChapter = makeChapter({
        chapter_id: 1,
        levelId: 2,
        chapter_orderIndex: 1,
      });
      const nextChapter = makeChapter({
        chapter_id: 2,
        levelId: 2,
        chapter_orderIndex: 2,
      });
      const firstNextLesson = makeLesson({
        lesson_id: 20,
        chapter_id: 2,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null; // No next lesson in current chapter
        if (args?.where?.chapter_id === 2 && args?.order)
          return firstNextLesson;
        return null;
      });

      chapterRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.chapter_id === 1) return currentChapter;
        if (args?.where?.levelId === 2 && args?.where?.chapter_orderIndex)
          return nextChapter;
        return null;
      });

      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => x);

      // Mock isChapterCompletedForUser to return true
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 10, chapter_id: 1 }),
      ] as any);
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.SKIPPED,
        }),
      ]);

      const res = await service.skipLessonAndUnlockNext('u1', 10);

      expect(res.skipped.status).toBe(LessonProgressStatus.SKIPPED);
      expect(res.unlockedNext?.lessonId).toBe(20);
      expect(res.unlockedNext?.status).toBe(LessonProgressStatus.IN_PROGRESS);
    });

    it('returns null unlockedNext when chapter not completed after skipping last lesson', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 2, // Last lesson in chapter
      });
      const currentChapter = makeChapter({
        chapter_id: 1,
        levelId: 2,
        chapter_orderIndex: 1,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null; // No next lesson in current chapter
        return null;
      });

      chapterRepo.findOne.mockResolvedValue(currentChapter as any);
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => x);

      // Mock isChapterCompletedForUser to return false (chapter not completed)
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 9, chapter_id: 1 }),
        makeLesson({ lesson_id: 10, chapter_id: 1 }),
      ] as any);
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.SKIPPED,
        }),
        // Missing progress for lesson 9, so chapter not completed
      ]);

      const res = await service.skipLessonAndUnlockNext('u1', 10);

      expect(res.skipped.status).toBe(LessonProgressStatus.SKIPPED);
      expect(res.unlockedNext).toBeNull();
    });

    it('updates existing next lesson progress from LOCKED to IN_PROGRESS', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      // Current lesson progress doesn't exist, next lesson is locked
      const progressByLessonId = new Map<number, LessonProgress | null>();
      progressByLessonId.set(10, null);
      progressByLessonId.set(11, makeProgress({
        lessonId: 11,
        userId: 'u1',
        status: LessonProgressStatus.LOCKED,
        mapLessonId: null,
      }));

      progressRepo.findOne.mockImplementation(async (args: any) => {
        const lid = args?.where?.lessonId;
        return progressByLessonId.get(lid) ?? null;
      });

      progressRepo.save.mockImplementation(async (x: any) => {
        if (x.lessonId === 10) {
          x.status = LessonProgressStatus.SKIPPED;
          x.progressPercent = 100;
          x.completedAt = new Date();
        } else if (x.lessonId === 11) {
          x.status = LessonProgressStatus.IN_PROGRESS;
          x.lastViewedAt = new Date();
          x.mapLessonId = 10;
        }
        progressByLessonId.set(x.lessonId, x);
        return x;
      });

      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      const res = await service.skipLessonAndUnlockNext('u1', 10);

      expect(res.unlockedNext?.status).toBe(LessonProgressStatus.IN_PROGRESS);
      // Note: mapLessonId is not exposed in the response DTO, only stored internally
      expect(progressRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lessonId: 11,
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
    });

    it('does not call quiz service for non-checkpoint lessons', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
        lesson_type: 'article' as any,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => x);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      await service.skipLessonAndUnlockNext('u1', 10);

      expect(quizService.skipCheckpointsByLesson).not.toHaveBeenCalled();
    });
  });

  describe('getChapterProgress', () => {
    it('throws when chapter not found', async () => {
      chapterRepo.findOne.mockResolvedValue(null);
      await expect(service.getChapterProgress('u1', 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns zeros when no lessons', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1 }) as any,
      );
      lessonRepo.find.mockResolvedValue([]);

      const res = await service.getChapterProgress('u1', 1);
      expect(res.totalItems).toBe(0);
      expect(res.percent).toBe(0);
    });

    it('returns 0 when chapter locked (no progress rows and has prev chapter not completed)', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({
          chapter_id: 2,
          levelId: 2,
          chapter_orderIndex: 2,
        }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 20, chapter_id: 2, orderIndex: 1 }),
      ] as any);

      // isChapterUnlockedForUser: no existing progress in this chapter
      progressRepo.findOne.mockResolvedValue(null);
      // prev chapter exists
      chapterRepo.findOne.mockResolvedValueOnce(
        makeChapter({
          chapter_id: 2,
          levelId: 2,
          chapter_orderIndex: 2,
        }) as any,
      );
      chapterRepo.findOne.mockResolvedValueOnce(
        makeChapter({
          chapter_id: 1,
          levelId: 2,
          chapter_orderIndex: 1,
        }) as any,
      );

      // isChapterCompletedForUser on prev chapter returns false
      lessonRepo.find.mockResolvedValueOnce([
        makeLesson({ lesson_id: 10, chapter_id: 2 }),
      ] as any);
      lessonRepo.find.mockResolvedValueOnce([
        makeLesson({ lesson_id: 1, chapter_id: 1 }),
      ] as any);
      progressRepo.find.mockResolvedValueOnce([]);

      const res = await service.getChapterProgress('u1', 2);
      expect(res.percent).toBe(0);
      expect(res.resumeLessonId).toBeNull();
    });

    it('computes percent and resumeLessonId when unlocked', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }),
        makeLesson({ lesson_id: 11, chapter_id: 1, orderIndex: 2 }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 50,
        }),
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.LOCKED,
          progressPercent: 0,
        }),
      ]);

      const res = await service.getChapterProgress('u1', 1);
      expect(res.percent).toBe(25);
      expect(res.resumeLessonId).toBe(10);
    });

    it('returns resumeLessonId null when first not-done is locked', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }),
        makeLesson({ lesson_id: 11, chapter_id: 1, orderIndex: 2 }),
      ] as any);

      // unlocked
      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));
      // progress: first completed, second locked
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.COMPLETED,
          progressPercent: null as any,
        }),
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.LOCKED,
          progressPercent: 0,
        }),
      ]);

      const res = await service.getChapterProgress('u1', 1);
      expect(res.resumeLessonId).toBeNull();
      // completed should count as 100 even if progressPercent null
      expect(res.percent).toBe(50);
    });

    it('treats NaN progressPercent as 0 when computing chapter percent', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 'nope' as any,
        }),
      ]);

      const res = await service.getChapterProgress('u1', 1);
      expect(res.percent).toBe(0);
    });
  });

  describe('getChapterRoadmap', () => {
    it('throws when chapter not found', async () => {
      chapterRepo.findOne.mockResolvedValue(null);
      await expect(service.getChapterRoadmap('u1', 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns empty roadmap when no lessons', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([]);

      const res = await service.getChapterRoadmap('u1', 1);
      expect(res.items).toEqual([]);
      expect(res.progressPercent).toBe(0);
    });

    it('returns LOCKED items when chapter locked', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({
          chapter_id: 2,
          levelId: 2,
          chapter_orderIndex: 2,
        }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 20,
          chapter_id: 2,
          lesson_title: 'A',
          lesson_type: 'article' as any,
          isPublished: true,
          orderIndex: 1,
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(null);
      chapterRepo.findOne.mockResolvedValueOnce(
        makeChapter({
          chapter_id: 2,
          levelId: 2,
          chapter_orderIndex: 2,
        }) as any,
      );
      chapterRepo.findOne.mockResolvedValueOnce(
        makeChapter({
          chapter_id: 1,
          levelId: 2,
          chapter_orderIndex: 1,
        }) as any,
      );
      lessonRepo.find.mockResolvedValueOnce([
        makeLesson({ lesson_id: 20, chapter_id: 2 }),
      ] as any);
      lessonRepo.find.mockResolvedValueOnce([
        makeLesson({ lesson_id: 1, chapter_id: 1 }),
      ] as any);
      progressRepo.find.mockResolvedValueOnce([]);

      const res = await service.getChapterRoadmap('u1', 2);
      expect(res.items[0].status).toBe(LessonProgressStatus.LOCKED);
      expect(res.nextAvailableLessonId).toBeNull();
    });

    it('initializes progress rows when none exist and returns streak fields', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 10,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'L1',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/10.mp4',
        }),
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 2,
          lesson_title: 'L2',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/11.mp4',
        }),
      ] as any);

      // unlocked: existing progress row in this chapter
      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));

      // find progress rows: empty first => triggers init; then refreshed non-empty
      progressRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
        }),
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.LOCKED,
          progressPercent: 0,
          mapLessonId: 10,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
        streak: { currentStreak: 0 },
      });

      const res = await service.getChapterRoadmap('u1', 1);

      expect(progressRepo.save).toHaveBeenCalled();
      expect(res.items).toHaveLength(2);
      expect(res.nextAvailableLessonId).toBe(10);
      expect(res.streakStatus).toBe('IN_PROGRESS');
      expect(res.isReward).toBe(false);
    });

    it('returns streakStatus COMPLETE when flame is on', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 10,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'L1',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/10.mp4',
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.COMPLETED,
          progressPercent: null as any,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: true,
        isFlameOn: true,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      expect(res.streakStatus).toBe('COMPLETE');
      expect(res.isReward).toBe(true);
      expect(res.items[0].progressPercent).toBe(100);
    });

    it('includes video lessons with a URL even when DB isPublished is false', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 10,
          chapter_id: 1,
          orderIndex: 0,
          lesson_title: 'Article',
          lesson_type: 'article' as any,
          isPublished: true,
        }),
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'Video',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/1.mp4',
          isPublished: false,
        }),
        makeLesson({
          lesson_id: 12,
          chapter_id: 1,
          orderIndex: 2,
          lesson_title: 'Draft',
          lesson_type: 'article' as any,
          isPublished: false,
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
        }),
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.LOCKED,
          progressPercent: 0,
          mapLessonId: 10,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      expect(res.items.map((item) => item.lessonId)).toEqual([10, 11]);
      expect(res.items.find((item) => item.lessonId === 11)?.isPublished).toBe(
        true,
      );
    });

    it('forces progressPercent=100 for COMPLETED even if stored progressPercent is lower', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 10,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'L1',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/10.mp4',
        }),
      ] as any);

      // unlocked
      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 10 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 10,
          status: LessonProgressStatus.COMPLETED,
          progressPercent: 80,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);
      expect(res.items[0].status).toBe(LessonProgressStatus.COMPLETED);
      expect(res.items[0].progressPercent).toBe(100);
      expect(res.progressPercent).toBe(100);
    });
  });

  describe('getLevelChapterRoadmaps', () => {
    it('returns [] when no chapters', async () => {
      chapterRepo.find.mockResolvedValue([]);
      const res = await service.getLevelChapterRoadmaps('u1', 1);
      expect(res).toEqual([]);
    });

    it('returns roadmaps for chapters', async () => {
      chapterRepo.find.mockResolvedValue([
        makeChapter({ chapter_id: 1 }),
        makeChapter({ chapter_id: 2 }),
      ] as any);
      const spy = jest.spyOn(service, 'getChapterRoadmap').mockResolvedValue({
        chapterId: 1,
        chapterTitle: 'x',
        progressPercent: 0,
        items: [],
        nextAvailableLessonId: null,
      } as any);

      const res = await service.getLevelChapterRoadmaps('u1', 2);
      expect(res).toHaveLength(2);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Redis Cache Invalidation', () => {
    it('invalidates cache when upsertLessonProgress is called', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });

      lessonRepo.findOne.mockResolvedValue(lesson as any);
      progressRepo.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return lesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });

      lessonRepo.find.mockResolvedValue([] as any);
      progressRepo.find.mockResolvedValue([] as any);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      await service.upsertLessonProgress('u1', 10, {
        progressPercent: 50,
      } as any);

      expect(redisCacheService.deleteByPrefix).toHaveBeenCalledWith(
        'learner-home:user:u1:',
      );
    });

    it('invalidates cache when skipLessonAndUnlockNext is called', async () => {
      const currentLesson = makeLesson({
        lesson_id: 10,
        chapter_id: 1,
        orderIndex: 1,
      });
      const nextLesson = makeLesson({
        lesson_id: 11,
        chapter_id: 1,
        orderIndex: 2,
      });

      lessonRepo.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10) return currentLesson;
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return nextLesson;
        return null;
      });

      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockImplementation(async (x: any) => x);
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      await service.skipLessonAndUnlockNext('u1', 10);

      expect(redisCacheService.deleteByPrefix).toHaveBeenCalledWith(
        'learner-home:user:u1:',
      );
    });

    it('handles missing Redis cache service gracefully', async () => {
      // Create a new service instance without Redis cache service
      const moduleWithoutRedis: TestingModule = await Test.createTestingModule({
        providers: [
          ProgressService,
          {
            provide: getRepositoryToken(LessonProgress),
            useValue: {
              find: jest.fn(),
              findOne: jest.fn(),
              create: jest.fn((x: any) => x),
              save: jest.fn(async (x: any) => x),
            },
          },
          {
            provide: getRepositoryToken(Lesson),
            useValue: {
              find: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Chapter),
            useValue: {
              find: jest.fn(),
              findOne: jest.fn(),
            },
          },
          {
            provide: StreakService,
            useValue: {
              bumpStreak: jest.fn(),
              getStreak: jest.fn(),
            },
          },
          {
            provide: QuizService,
            useValue: {
              skipCheckpointsByLesson: jest.fn(),
            },
          },
          // Note: RedisCacheService is not provided here
        ],
      }).compile();

      const serviceWithoutRedis = moduleWithoutRedis.get(ProgressService);
      const progressRepoWithoutRedis = moduleWithoutRedis.get(getRepositoryToken(LessonProgress));
      const lessonRepoWithoutRedis = moduleWithoutRedis.get(getRepositoryToken(Lesson));
      const chapterRepoWithoutRedis = moduleWithoutRedis.get(getRepositoryToken(Chapter));

      lessonRepoWithoutRedis.findOne.mockResolvedValue(
        makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 }) as any,
      );
      progressRepoWithoutRedis.findOne.mockResolvedValue(
        makeProgress({
          lessonId: 10,
          userId: 'u1',
          status: LessonProgressStatus.IN_PROGRESS,
        }),
      );
      lessonRepoWithoutRedis.findOne.mockImplementation(async (args: any) => {
        if (args?.where?.lesson_id === 10)
          return makeLesson({ lesson_id: 10, chapter_id: 1, orderIndex: 1 });
        if (args?.where?.chapter_id === 1 && args?.where?.orderIndex)
          return null;
        return null;
      });
      lessonRepoWithoutRedis.find.mockResolvedValue([] as any);
      progressRepoWithoutRedis.find.mockResolvedValue([] as any);
      chapterRepoWithoutRedis.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2 }) as any,
      );

      // Should not throw error even without Redis service
      const res = await serviceWithoutRedis.upsertLessonProgress('u1', 10, {
        progressPercent: 50,
      } as any);

      expect(res.status).toBe(LessonProgressStatus.IN_PROGRESS);
    });
  });

  describe('Video Lesson Published State Resolution', () => {
    it('includes video lessons with URL in roadmap even when isPublished is false', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'Video with URL',
          lesson_type: 'video' as any,
          lesson_videoUrl: 'https://cdn.skllracademy.com/videos/11.mp4',
          isPublished: false, // This should be overridden by URL presence
        }),
        makeLesson({
          lesson_id: 12,
          chapter_id: 1,
          orderIndex: 2,
          lesson_title: 'Video without URL',
          lesson_type: 'video' as any,
          lesson_videoUrl: '',
          isPublished: false,
        }),
        makeLesson({
          lesson_id: 13,
          chapter_id: 1,
          orderIndex: 3,
          lesson_title: 'Published Article',
          lesson_type: 'article' as any,
          isPublished: true,
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 11 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      // Should include lesson 11 (video with URL) despite isPublished=false
      expect(res.items.map((item) => item.lessonId)).toContain(11);
      expect(res.items.find((item) => item.lessonId === 11)?.isPublished).toBe(true);

      // Should not include lesson 12 (video without URL and isPublished=false)
      expect(res.items.map((item) => item.lessonId)).not.toContain(12);

      // Should include lesson 13 (published article)
      expect(res.items.map((item) => item.lessonId)).toContain(13);
    });

    it('excludes video lessons without URL even when isPublished is true', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'Video without URL',
          lesson_type: 'video' as any,
          lesson_videoUrl: '',
          isPublished: true, // Should be excluded due to empty URL
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 11 }));
      progressRepo.find.mockResolvedValue([]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      // Should not include the video lesson without URL
      expect(res.items).toHaveLength(0);
    });

    it('includes non-video lessons based on isPublished flag only', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'Published Article',
          lesson_type: 'article' as any,
          isPublished: true,
        }),
        makeLesson({
          lesson_id: 12,
          chapter_id: 1,
          orderIndex: 2,
          lesson_title: 'Unpublished Article',
          lesson_type: 'article' as any,
          isPublished: false,
        }),
        makeLesson({
          lesson_id: 13,
          chapter_id: 1,
          orderIndex: 3,
          lesson_title: 'Published Quiz',
          lesson_type: 'quiz' as any,
          isPublished: true,
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 11 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 11,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      // Should include published non-video lessons
      expect(res.items.map((item) => item.lessonId)).toContain(11);
      expect(res.items.map((item) => item.lessonId)).toContain(13);

      // Should not include unpublished non-video lessons
      expect(res.items.map((item) => item.lessonId)).not.toContain(12);
    });

    it('handles whitespace-only video URLs correctly', async () => {
      chapterRepo.findOne.mockResolvedValue(
        makeChapter({ chapter_id: 1, levelId: 2, chapter_title: 'Ch' }) as any,
      );
      lessonRepo.find.mockResolvedValue([
        makeLesson({
          lesson_id: 11,
          chapter_id: 1,
          orderIndex: 1,
          lesson_title: 'Video with whitespace URL',
          lesson_type: 'video' as any,
          lesson_videoUrl: '   ', // Whitespace only
          isPublished: true,
        }),
        makeLesson({
          lesson_id: 12,
          chapter_id: 1,
          orderIndex: 2,
          lesson_title: 'Video with valid URL',
          lesson_type: 'video' as any,
          lesson_videoUrl: ' https://cdn.skllracademy.com/videos/12.mp4 ', // URL with whitespace
          isPublished: false,
        }),
      ] as any);

      progressRepo.findOne.mockResolvedValue(makeProgress({ lessonId: 12 }));
      progressRepo.find.mockResolvedValue([
        makeProgress({
          lessonId: 12,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
        }),
      ]);

      streakService.getStreak.mockResolvedValue({
        isReward: false,
        isFlameOn: false,
      });

      const res = await service.getChapterRoadmap('u1', 1);

      // Should not include lesson 11 (whitespace-only URL)
      expect(res.items.map((item) => item.lessonId)).not.toContain(11);

      // Should include lesson 12 (URL with surrounding whitespace)
      expect(res.items.map((item) => item.lessonId)).toContain(12);
      expect(res.items.find((item) => item.lessonId === 12)?.isPublished).toBe(true);
    });
  });
});
