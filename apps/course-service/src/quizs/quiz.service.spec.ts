import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { QuizService } from './quiz.service';
import { Quizs } from './entities/quizs.entity';
import { QuizsCheckpoint } from './entities/checkpoint.entity';
import {
  QuizsResult,
  QuizsResultType,
  QuizsStatus,
} from './entities/quizs-result.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { UserXp } from './entities/user-xp.entity';

describe('QuizService (quiz)', () => {
  let service: QuizService;

  type QuizRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  type CheckpointRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  type ResultRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  type LessonRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    exist: jest.Mock;
  };

  type ChapterRepoMock = {
    update: jest.Mock;
  };

  type UserXpRepoMock = {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let quizRepo: QuizRepoMock;
  let checkpointRepo: CheckpointRepoMock;
  let resultRepo: ResultRepoMock;
  let lessonRepo: LessonRepoMock;
  let userXpRepo: UserXpRepoMock;

  const makeQuiz = (overrides: Partial<Quizs> = {}): Quizs =>
    ({
      quizsId: 1,
      lessonId: 10,
      quizsType: 'multiple_choice',
      quizsQuestions: 'Q?',
      quizsOption: ['a', 'b', 'c', 'd'] as any,
      quizsAnswer: 'a' as any,
      quizsExplanation: 'E',
      ...overrides,
    }) as Quizs;

  const makeCheckpoint = (
    overrides: Partial<QuizsCheckpoint> = {},
  ): QuizsCheckpoint =>
    ({
      checkpointId: 1,
      lessonId: 10,
      checkpointScore: 5,
      checkpointType: 'multiple_choice',
      checkpointQuestions: 'Q?',
      checkpointOption: ['a', 'b', 'c', 'd'] as any,
      checkpointAnswer: 'a' as any,
      checkpointExplanation: 'E',
      ...overrides,
    }) as QuizsCheckpoint;

  const makeResult = (overrides: Partial<QuizsResult> = {}): QuizsResult =>
    ({
      id: 1,
      lessonId: 10,
      userId: 'u1',
      type: QuizsResultType.QUIZ,
      checkpointId: null as any,
      status: QuizsStatus.PENDING,
      userAnswer: null as any,
      isCorrect: null as any,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as QuizsResult;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        {
          provide: getRepositoryToken(Quizs),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(QuizsCheckpoint),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(QuizsResult),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            exist: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Chapter),
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserXp),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(QuizService);

    quizRepo = module.get(getRepositoryToken(Quizs));
    checkpointRepo = module.get(getRepositoryToken(QuizsCheckpoint));
    resultRepo = module.get(getRepositoryToken(QuizsResult));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    userXpRepo = module.get(getRepositoryToken(UserXp));

    jest.clearAllMocks();
  });

  describe('createQuizs', () => {
    it('updates existing quiz', async () => {
      const existing = makeQuiz({ lessonId: 1, quizsAnswer: 'old' });
      quizRepo.findOne.mockResolvedValue(existing);
      quizRepo.save.mockImplementation(async (q) => q);

      const saved = await service.createQuizs({
        lesson_id: 1,
        quizs_type: 'multiple_choice',
        quizs_questions: 'Q2',
        quizs_option: ['a', 'b', 'c', 'd'],
        quizs_answer: 'a',
        quizs_explanation: 'E2',
      } as any);

      expect(saved.quizsQuestions).toBe('Q2');
      expect(quizRepo.create).not.toHaveBeenCalled();
    });

    it('creates new quiz when not existing', async () => {
      quizRepo.findOne.mockResolvedValue(null);
      quizRepo.create.mockImplementation((x: any) => x);
      quizRepo.save.mockImplementation(async (q) => ({ ...q, quizsId: 99 }));

      const saved = await service.createQuizs({
        lesson_id: 10,
        quizs_type: 'multiple_choice',
        quizs_questions: 'Q',
        quizs_option: ['a', 'b', 'c', 'd'],
        quizs_answer: 'a',
        quizs_explanation: 'E',
      } as any);

      expect(saved.quizsId).toBe(99);
      expect(quizRepo.create).toHaveBeenCalled();
    });
  });

  describe('getQuizWithStatus', () => {
    it('throws when quiz not found', async () => {
      quizRepo.findOne.mockResolvedValue(null);
      await expect(service.getQuizWithStatus(10, 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns NOT_ATTEMPTED when no result', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      resultRepo.findOne.mockResolvedValue(null);

      const res = await service.getQuizWithStatus(10, 'u1');
      expect(res.status).toBe('NOT_ATTEMPTED');
      expect(res.quizs_answer).toBeNull();
    });

    it('returns PENDING when result has no userAnswer', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      resultRepo.findOne.mockResolvedValue(
        makeResult({ status: QuizsStatus.PENDING, userAnswer: null }),
      );

      const res = await service.getQuizWithStatus(10, 'u1');
      expect(res.status).toBe(QuizsStatus.PENDING);
      expect(res.quizs_answer).toBeNull();
    });

    it('returns completed result with solution when attempted', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'A' }),
      );
      resultRepo.findOne.mockResolvedValue(
        makeResult({
          status: QuizsStatus.PENDING,
          userAnswer: 'a',
          isCorrect: true,
          updatedAt: new Date('2026-03-05T01:00:00.000Z'),
        }),
      );

      const res = await service.getQuizWithStatus(10, 'u1');
      expect(res.quizs_answer).toBe('A');
      expect(res.status).toBe(QuizsStatus.COMPLETED);
      expect(res.is_correct).toBe(true);
    });

    it('keeps COMPLETED status when result already completed', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'A' }),
      );
      resultRepo.findOne.mockResolvedValue(
        makeResult({
          status: QuizsStatus.COMPLETED,
          userAnswer: 'a',
          isCorrect: true,
          updatedAt: new Date('2026-03-05T01:00:00.000Z'),
        }),
      );

      const res = await service.getQuizWithStatus(10, 'u1');
      expect(res.status).toBe(QuizsStatus.COMPLETED);
      expect(res.quizs_answer).toBe('A');
    });
  });

  describe('checkAndSaveAnswer', () => {
    it('throws when quiz not found', async () => {
      quizRepo.findOne.mockResolvedValue(null);
      await expect(
        service.checkAndSaveAnswer(10, 'u1', 'a'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws conflict when already attempted', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      resultRepo.findOne.mockResolvedValue(
        makeResult({ userAnswer: 'a', status: QuizsStatus.COMPLETED }),
      );

      await expect(
        service.checkAndSaveAnswer(10, 'u1', 'a'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows answering again when previous result was SKIPPED', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      resultRepo.findOne.mockResolvedValue(
        makeResult({ status: QuizsStatus.SKIPPED, userAnswer: null }),
      );
      resultRepo.save.mockImplementation(async (r) => r);
      lessonRepo.findOne.mockResolvedValue(null);

      const res = await service.checkAndSaveAnswer(10, 'u1', 'a');

      expect(resultRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: QuizsStatus.COMPLETED,
          userAnswer: 'a',
        }),
      );
      expect(res.is_correct).toBe(true);
    });

    it('updates existing PENDING result when userAnswer is null', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'A', quizsExplanation: 'E' }),
      );
      resultRepo.findOne.mockResolvedValue(
        makeResult({ status: QuizsStatus.PENDING, userAnswer: null }),
      );
      resultRepo.save.mockImplementation(async (r) => r);
      lessonRepo.findOne.mockResolvedValue(null);

      const res = await service.checkAndSaveAnswer(10, 'u1', 'a');

      expect(resultRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userAnswer: 'a',
          status: QuizsStatus.COMPLETED,
        }),
      );
      expect(res.quizs_answer).toBe('A');
    });

    it('normalizes Thai true answer before checking correctness', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'true', quizsExplanation: 'E' }),
      );
      resultRepo.findOne.mockResolvedValue(null);
      resultRepo.create.mockImplementation((x: any) => x);
      resultRepo.save.mockImplementation(async (x: any) => x);
      lessonRepo.findOne.mockResolvedValue(null);

      const res = await service.checkAndSaveAnswer(10, 'u1', 'ถูก');

      expect(resultRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userAnswer: 'ถูก',
          isCorrect: true,
          status: QuizsStatus.COMPLETED,
        }),
      );
      expect(res.is_correct).toBe(true);
    });

    it('saves result and syncs userXp when correct', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'A', quizsExplanation: 'E' }),
      );
      resultRepo.findOne.mockResolvedValue(null);
      resultRepo.create.mockImplementation((x: any) => x);
      resultRepo.save.mockResolvedValue(
        makeResult({
          status: QuizsStatus.COMPLETED,
          userAnswer: 'a',
          isCorrect: true,
        }),
      );

      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 10,
        chapter_id: 1,
      } as any);
      userXpRepo.findOne.mockResolvedValue(null);
      lessonRepo.find.mockResolvedValue([
        { lesson_id: 10 },
        { lesson_id: 11 },
      ] as any);
      checkpointRepo.find.mockResolvedValue([
        makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointScore: 5 }),
      ]);

      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
      };
      userXpRepo.createQueryBuilder.mockReturnValue(qb);

      userXpRepo.create.mockImplementation((x: any) => x);
      userXpRepo.save.mockImplementation(async (x) => x);

      const res = await service.checkAndSaveAnswer(10, 'u1', 'a');

      expect(res.is_correct).toBe(true);
      expect(res.quizs_answer).toBe('A');
      expect(userXpRepo.save).toHaveBeenCalled();
    });

    it('returns solution but does not sync XP when incorrect', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsAnswer: 'a', quizsExplanation: 'E' }),
      );
      resultRepo.findOne.mockResolvedValue(null);
      resultRepo.create.mockImplementation((x: any) => x);
      resultRepo.save.mockResolvedValue(
        makeResult({
          status: QuizsStatus.COMPLETED,
          userAnswer: 'b',
          isCorrect: false,
        }),
      );

      const res = await service.checkAndSaveAnswer(10, 'u1', 'b');

      expect(res.is_correct).toBe(false);
      expect(userXpRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('skipQuiz', () => {
    it('creates result if missing and marks SKIPPED', async () => {
      resultRepo.findOne.mockResolvedValue(null);
      resultRepo.create.mockImplementation((x: any) => x);
      resultRepo.save.mockImplementation(async (x) => x);

      const saved = await service.skipQuiz(10, 'u1');
      expect(saved.status).toBe(QuizsStatus.SKIPPED);
    });

    it('marks existing result as SKIPPED', async () => {
      resultRepo.findOne.mockResolvedValue(
        makeResult({ status: QuizsStatus.PENDING }),
      );
      resultRepo.save.mockImplementation(async (x) => x);

      const saved = await service.skipQuiz(10, 'u1');
      expect(saved.status).toBe(QuizsStatus.SKIPPED);
      expect(resultRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAllQuizs', () => {
    it('maps fields', async () => {
      quizRepo.find.mockResolvedValue([makeQuiz({ quizsId: 1, lessonId: 10 })]);
      const res = await service.findAllQuizs();
      expect(res[0].quiz_id).toBe(1);
      expect(res[0].lessonId).toBe(10);
    });
  });

  describe('findOneQuizsByLesson', () => {
    it('throws when not found', async () => {
      quizRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneQuizsByLesson(10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns quiz', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      await expect(service.findOneQuizsByLesson(10)).resolves.toBeTruthy();
    });
  });

  describe('updateQuizs', () => {
    it('updates fields', async () => {
      quizRepo.findOne.mockResolvedValue(
        makeQuiz({ lessonId: 10, quizsQuestions: 'old' }),
      );
      quizRepo.save.mockImplementation(async (q) => q);

      const res = await service.updateQuizs(10, {
        quizs_questions: 'new',
      } as any);
      expect(res.quizsQuestions).toBe('new');
    });
  });

  describe('removeQuizs', () => {
    it('removes quiz and clears lesson_description when present', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      quizRepo.remove.mockResolvedValue({} as any);
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 10,
        lesson_description: 'x',
      } as any);
      lessonRepo.save.mockResolvedValue({} as any);

      const res = await service.removeQuizs(10);
      expect(res.message).toContain('lesson_description cleared');
    });

    it('removes quiz and keeps message simple when no lesson', async () => {
      quizRepo.findOne.mockResolvedValue(makeQuiz({ lessonId: 10 }));
      quizRepo.remove.mockResolvedValue({} as any);
      lessonRepo.findOne.mockResolvedValue(null);

      const res = await service.removeQuizs(10);
      expect(res.message).toBe('Quiz 10 deleted.');
    });
  });
});
