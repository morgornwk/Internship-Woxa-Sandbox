import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { QuizService } from './quiz.service';
import { Quizs } from './entities/quizs.entity';
import { QuizsCheckpoint } from './entities/checkpoint.entity';
import { QuizsResult, QuizsResultType, QuizsStatus } from './entities/quizs-result.entity';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { UserXp } from './entities/user-xp.entity';

describe('QuizService (checkpoint)', () => {
    let service: QuizService;

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

    let checkpointRepo: CheckpointRepoMock;
    let resultRepo: ResultRepoMock;
    let lessonRepo: LessonRepoMock;
    let chapterRepo: ChapterRepoMock;
    let userXpRepo: UserXpRepoMock;

    const makeCheckpoint = (overrides: Partial<QuizsCheckpoint> = {}): QuizsCheckpoint =>
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
            type: QuizsResultType.CHECKPOINT,
            checkpointId: 1,
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
        checkpointRepo = module.get(getRepositoryToken(QuizsCheckpoint));
        resultRepo = module.get(getRepositoryToken(QuizsResult));
        lessonRepo = module.get(getRepositoryToken(Lesson));
        chapterRepo = module.get(getRepositoryToken(Chapter));
        userXpRepo = module.get(getRepositoryToken(UserXp));

        jest.clearAllMocks();
    });

    describe('findOneCheckpointById', () => {
        it('throws when not found', async () => {
            checkpointRepo.findOne.mockResolvedValue(null);
            await expect(service.findOneCheckpointById(1)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns checkpoint', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1 }));
            const res = await service.findOneCheckpointById(1);
            expect(res.checkpointId).toBe(1);
        });
    });

    describe('findOneCheckpointByLessonId', () => {
        it('throws when checkpoint missing', async () => {
            checkpointRepo.findOne.mockResolvedValue(null);
            await expect(service.findOneCheckpointByLessonId(10)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws when lesson not checkpoint type', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ lessonId: 10 }));
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.ARTICLE } as any);
            await expect(service.findOneCheckpointByLessonId(10)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns checkpoint when lesson is CHECKPOINT', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ lessonId: 10 }));
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.CHECKPOINT } as any);
            const res = await service.findOneCheckpointByLessonId(10);
            expect(res.lessonId).toBe(10);
        });
    });

    describe('updateCheckpoint', () => {
        it('throws when checkpoint not found', async () => {
            checkpointRepo.findOne.mockResolvedValue(null);
            await expect(service.updateCheckpoint(1, { checkpoint_questions: 'x' } as any)).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });

        it('recalculates score when lesson has level orderIndex', async () => {
            const checkpoint = makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointScore: 5 });
            checkpointRepo.findOne.mockResolvedValue(checkpoint);
            lessonRepo.findOne.mockResolvedValue({
                lesson_id: 10,
                chapter: { level: { level_orderIndex: 1 } },
            } as any);
            checkpointRepo.save.mockImplementation(async (c) => c as any);

            const res = await service.updateCheckpoint(1, { checkpoint_questions: 'new' } as any);
            expect(res.checkpointScore).toBe(10);
            expect(res.checkpointQuestions).toBe('new');
        });
    });

    describe('updateCheckpointByLessonId', () => {
        it('publishes lesson and syncs chapter published', async () => {
            const cp = makeCheckpoint({ checkpointId: 7, lessonId: 10 });
            checkpointRepo.findOne.mockImplementation(async (args: any) => {
                if (args?.where?.checkpointId) return cp as any;
                if (args?.where?.lessonId) return cp as any;
                return null as any;
            });

            lessonRepo.findOne
                .mockResolvedValueOnce({ lesson_id: 10, lesson_type: LessonType.CHECKPOINT, chapter_id: 1 } as any)
                .mockResolvedValueOnce({ lesson_id: 10, chapter: { level: { level_orderIndex: 0 } } } as any)
                .mockResolvedValueOnce({ lesson_id: 10, chapter_id: 1 } as any);

            checkpointRepo.save.mockImplementation(async (x) => x as any);
            lessonRepo.update.mockResolvedValue({} as any);
            lessonRepo.exist.mockResolvedValue(true);

            const res = await service.updateCheckpointByLessonId(10, { checkpoint_questions: 'x' } as any);

            expect(res.checkpointId).toBe(7);
            expect(lessonRepo.update).toHaveBeenCalledWith(10, { isPublished: true });
            expect(chapterRepo.update).toHaveBeenCalledWith(1, { isPublished: true });
        });
    });

    describe('removeCheckpointByLessonId', () => {
        it('unpublishes checkpoint lesson if published, and syncs chapter', async () => {
            const cp = makeCheckpoint({ checkpointId: 1, lessonId: 10 });
            checkpointRepo.findOne.mockResolvedValue(cp);
            lessonRepo.findOne.mockResolvedValue({
                lesson_id: 10,
                lesson_type: LessonType.CHECKPOINT,
                isPublished: true,
                chapter_id: 1,
                lesson_description: 'x',
            } as any);

            checkpointRepo.remove.mockResolvedValue({} as any);
            lessonRepo.save.mockResolvedValue({} as any);
            lessonRepo.update.mockResolvedValue({} as any);
            lessonRepo.exist.mockResolvedValue(false);

            const res = await service.removeCheckpointByLessonId(10);

            expect(res.message).toContain('Checkpoint 10 deleted');
            expect(lessonRepo.update).toHaveBeenCalledWith(10, { isPublished: false });
            expect(chapterRepo.update).toHaveBeenCalledWith(1, { isPublished: false });
        });
    });

    describe('createCheckpoint', () => {
        it('throws when lesson not found', async () => {
            lessonRepo.findOne.mockResolvedValue(null);
            await expect(service.createCheckpoint({ lesson_id: 10 } as any)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws when lesson is not CHECKPOINT', async () => {
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.ARTICLE } as any);
            await expect(service.createCheckpoint({ lesson_id: 10 } as any)).rejects.toBeInstanceOf(BadRequestException);
        });

        it('updates existing checkpoint and publishes lesson', async () => {
            lessonRepo.findOne.mockResolvedValue({
                lesson_id: 10,
                lesson_type: LessonType.CHECKPOINT,
                chapter_id: 1,
                chapter: { level: { level_orderIndex: 0 } },
            } as any);

            const existing = makeCheckpoint({ checkpointId: 1, lessonId: 10 });
            checkpointRepo.findOne.mockResolvedValue(existing);
            checkpointRepo.save.mockImplementation(async (x) => x as any);

            lessonRepo.update.mockResolvedValue({} as any);
            lessonRepo.exist.mockResolvedValue(true);

            const res = await service.createCheckpoint({
                lesson_id: 10,
                checkpoint_type: 'multiple_choice',
                checkpoint_questions: 'q',
                checkpoint_option: ['a', 'b', 'c', 'd'],
                checkpoint_answer: 'a',
                checkpoint_explanation: 'e',
            } as any);

            expect(res.lessonId).toBe(10);
            expect(lessonRepo.update).toHaveBeenCalledWith(10, { isPublished: true });
            expect(chapterRepo.update).toHaveBeenCalledWith(1, { isPublished: true });
        });

        it('creates new checkpoint when none exists', async () => {
            lessonRepo.findOne.mockResolvedValue({
                lesson_id: 10,
                lesson_type: LessonType.CHECKPOINT,
                chapter_id: 1,
                chapter: { level: { level_orderIndex: 0 } },
            } as any);

            checkpointRepo.findOne.mockResolvedValue(null);
            checkpointRepo.create.mockImplementation((x: any) => x);
            checkpointRepo.save.mockImplementation(async (x) => ({ ...x, checkpointId: 99 }) as any);

            lessonRepo.update.mockResolvedValue({} as any);
            lessonRepo.exist.mockResolvedValue(true);

            const res = await service.createCheckpoint({
                lesson_id: 10,
                checkpoint_type: 'multiple_choice',
                checkpoint_questions: 'q',
                checkpoint_option: ['a', 'b', 'c', 'd'],
                checkpoint_answer: 'a',
                checkpoint_explanation: 'e',
            } as any);

            expect(res.checkpointId).toBe(99);
            expect(chapterRepo.update).toHaveBeenCalledWith(1, { isPublished: true });
        });
    });

    describe('findCheckpointsByLesson', () => {
        it('throws when lesson not found', async () => {
            lessonRepo.findOne.mockResolvedValue(null);
            await expect(service.findCheckpointsByLesson(10, 'u1')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns [] when lesson is not checkpoint type', async () => {
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.ARTICLE } as any);
            await expect(service.findCheckpointsByLesson(10, 'u1')).resolves.toEqual([]);
        });

        it('returns [] when no checkpoints', async () => {
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.CHECKPOINT, chapter_id: 1 } as any);
            checkpointRepo.find.mockResolvedValue([]);
            await expect(service.findCheckpointsByLesson(10, 'u1')).resolves.toEqual([]);
        });

        it('maps checkpoints with student_progress', async () => {
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.CHECKPOINT, chapter_id: 1 } as any);
            checkpointRepo.find.mockResolvedValue([
                makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'a', checkpointScore: 5 }),
            ]);
            resultRepo.find.mockResolvedValue([
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, userAnswer: 'a', isCorrect: true, status: QuizsStatus.COMPLETED }),
            ]);

            const res = await service.findCheckpointsByLesson(10, 'u1');
            expect(res).toHaveLength(1);
            expect(res[0].student_progress.checkpoint_status).toBe('COMPLETED');
            expect(res[0].score).toBe(5);
            expect(res[0].checkpoint_explanation).toBe('E');
        });

        it('does not show solution when not attempted', async () => {
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, lesson_type: LessonType.CHECKPOINT, chapter_id: 1 } as any);
            checkpointRepo.find.mockResolvedValue([
                makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'a', checkpointExplanation: 'E', checkpointScore: 5 }),
            ]);
            resultRepo.find.mockResolvedValue([]);

            const res = await service.findCheckpointsByLesson(10, 'u1');
            expect(res[0].student_progress.correct_answer).toBeNull();
            expect(res[0].checkpoint_explanation).toBeNull();
            expect(res[0].score).toBeNull();
            expect(res[0].student_progress.checkpoint_status).toBe('PENDING');
        });
    });

    describe('skipCheckpoint', () => {
        it('throws when checkpoint not found', async () => {
            checkpointRepo.findOne.mockResolvedValue(null);
            await expect(service.skipCheckpoint(1, 'u1')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws when already completed', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1 }));
            resultRepo.findOne.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, userAnswer: 'a', isCorrect: true }),
            );

            await expect(service.skipCheckpoint(1, 'u1')).rejects.toBeInstanceOf(ConflictException);
        });

        it('returns SKIPPED immediately when already skipped', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1, checkpointAnswer: 'a' }));
            resultRepo.findOne.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, status: QuizsStatus.SKIPPED, userAnswer: null }),
            );

            const res = await service.skipCheckpoint(1, 'u1');
            expect(res.checkpoint_status).toBe('SKIPPED');
            expect(res.correct_answer).toBe('a');
        });

        it('creates/saves SKIPPED result when not existing', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1, lessonId: 10 }));
            resultRepo.findOne.mockResolvedValue(null);
            resultRepo.create.mockImplementation((x: any) => x);
            resultRepo.save.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, status: QuizsStatus.SKIPPED }),
            );

            const res = await service.skipCheckpoint(1, 'u1');
            expect(res.checkpoint_status).toBe('SKIPPED');
            expect(resultRepo.save).toHaveBeenCalled();
        });

        it('allows skip after wrong attempt (overwrites answer to null)', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'a' }));
            resultRepo.findOne.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, status: QuizsStatus.PENDING, userAnswer: 'b', isCorrect: false }),
            );
            resultRepo.save.mockImplementation(async (x: any) => x);

            const res = await service.skipCheckpoint(1, 'u1');

            expect(resultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: QuizsStatus.SKIPPED,
                userAnswer: null,
                isCorrect: null,
            }));
            expect(res.checkpoint_status).toBe('SKIPPED');
            expect(res.correct_answer).toBe('a');
        });
    });

    describe('skipCheckpointsByLesson', () => {
        it('returns [] when no checkpoints', async () => {
            checkpointRepo.find.mockResolvedValue([]);
            await expect(service.skipCheckpointsByLesson(10, 'u1')).resolves.toEqual([]);
        });

        it('skips all checkpoints', async () => {
            checkpointRepo.find.mockResolvedValue([
                makeCheckpoint({ checkpointId: 1 }),
                makeCheckpoint({ checkpointId: 2 }),
            ]);
            const spy = jest.spyOn(service, 'skipCheckpoint').mockResolvedValue({ checkpoint_id: 1 } as any);

            const res = await service.skipCheckpointsByLesson(10, 'u1');
            expect(res).toHaveLength(2);
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe('checkCheckpointAnswer', () => {
        it('throws when checkpoint not found', async () => {
            checkpointRepo.findOne.mockResolvedValue(null);
            await expect(service.checkCheckpointAnswer(1, 'u1', 'a')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('allows answering again when checkpoint was previously skipped', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1 }));
            resultRepo.findOne.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, status: QuizsStatus.SKIPPED }),
            );
            resultRepo.save.mockImplementation(async (x: any) => x);
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, chapter_id: 5 } as any);

            lessonRepo.find.mockResolvedValue([{ lesson_id: 10 }] as any);
            checkpointRepo.find.mockResolvedValue([makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointScore: 5, checkpointAnswer: 'a' })]);
            resultRepo.find.mockResolvedValue([
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, userAnswer: 'a', isCorrect: true, status: QuizsStatus.COMPLETED }),
            ]);
            userXpRepo.findOne.mockResolvedValue(null);
            const qb: any = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
            };
            userXpRepo.createQueryBuilder.mockReturnValue(qb);
            userXpRepo.create.mockImplementation((x: any) => x);
            userXpRepo.save.mockImplementation(async (x) => x as any);

            const res = await service.checkCheckpointAnswer(1, 'u1', 'a');

            expect(resultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: QuizsStatus.COMPLETED,
                userAnswer: 'a',
                isCorrect: true,
            }));
            expect(res.checkpoint_status).toBe('COMPLETED');
        });

        it('throws when checkpoint already completed', async () => {
            checkpointRepo.findOne.mockResolvedValue(makeCheckpoint({ checkpointId: 1 }));
            resultRepo.findOne.mockResolvedValue(
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, status: QuizsStatus.COMPLETED, userAnswer: 'a', isCorrect: true }),
            );

            await expect(service.checkCheckpointAnswer(1, 'u1', 'a')).rejects.toBeInstanceOf(ConflictException);
        });

        it('saves result and syncs xp when correct', async () => {
            const cp = makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'a', checkpointScore: 10 });
            checkpointRepo.findOne.mockResolvedValue(cp);
            resultRepo.findOne.mockResolvedValue(null);
            resultRepo.create.mockImplementation((x: any) => x);
            resultRepo.save.mockResolvedValue(makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1 }));

            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, chapter_id: 5 } as any);

            lessonRepo.find.mockResolvedValue([{ lesson_id: 10 }] as any);
            checkpointRepo.find.mockResolvedValue([cp]);
            resultRepo.find.mockResolvedValue([
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, isCorrect: true, userAnswer: 'a' }),
            ]);

            userXpRepo.findOne.mockResolvedValue(null);
            const qb: any = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
            };
            userXpRepo.createQueryBuilder.mockReturnValue(qb);
            userXpRepo.create.mockImplementation((x: any) => x);
            userXpRepo.save.mockImplementation(async (x) => x as any);

            const res = await service.checkCheckpointAnswer(1, 'u1', 'a');

            expect(res.is_correct).toBe(true);
            expect(res.score).toBe(10);
            expect(userXpRepo.save).toHaveBeenCalled();
        });

        it('normalizes Thai false answer before checking correctness', async () => {
            const cp = makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'false', checkpointScore: 10 });
            checkpointRepo.findOne.mockResolvedValue(cp);
            resultRepo.findOne.mockResolvedValue(null);
            resultRepo.create.mockImplementation((x: any) => x);
            resultRepo.save.mockImplementation(async (x: any) => x);
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, chapter_id: 5 } as any);

            lessonRepo.find.mockResolvedValue([{ lesson_id: 10 }] as any);
            checkpointRepo.find.mockResolvedValue([cp]);
            resultRepo.find.mockResolvedValue([
                makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1, isCorrect: true, userAnswer: 'ผิด' }),
            ]);

            userXpRepo.findOne.mockResolvedValue(null);
            const qb: any = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
            };
            userXpRepo.createQueryBuilder.mockReturnValue(qb);
            userXpRepo.create.mockImplementation((x: any) => x);
            userXpRepo.save.mockImplementation(async (x) => x as any);

            const res = await service.checkCheckpointAnswer(1, 'u1', 'ผิด');

            expect(resultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                userAnswer: 'ผิด',
                isCorrect: true,
                status: QuizsStatus.COMPLETED,
            }));
            expect(res.is_correct).toBe(true);
            expect(res.score).toBe(10);
        });

        it('returns PENDING and zero score when incorrect', async () => {
            const cp = makeCheckpoint({ checkpointId: 1, lessonId: 10, checkpointAnswer: 'a', checkpointScore: 10 });
            checkpointRepo.findOne.mockResolvedValue(cp);
            resultRepo.findOne.mockResolvedValue(null);
            resultRepo.create.mockImplementation((x: any) => x);
            resultRepo.save.mockResolvedValue(makeResult({ type: QuizsResultType.CHECKPOINT, checkpointId: 1 }));
            lessonRepo.findOne.mockResolvedValue({ lesson_id: 10, chapter_id: 5 } as any);

            lessonRepo.find.mockResolvedValue([{ lesson_id: 10 }] as any);
            checkpointRepo.find.mockResolvedValue([cp]);
            resultRepo.find.mockResolvedValue([]);
            userXpRepo.findOne.mockResolvedValue(null);
            const qb: any = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
            };
            userXpRepo.createQueryBuilder.mockReturnValue(qb);
            userXpRepo.create.mockImplementation((x: any) => x);
            userXpRepo.save.mockImplementation(async (x) => x as any);

            const res = await service.checkCheckpointAnswer(1, 'u1', 'b');
            expect(res.is_correct).toBe(false);
            expect(res.score).toBe(0);
            expect(res.checkpoint_status).toBe('PENDING');
        });
    });
});
