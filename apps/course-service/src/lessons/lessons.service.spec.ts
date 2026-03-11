import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LessonsService } from './lessons.service';
import { Lesson, LessonType } from './entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { Article } from '../articles/entities/article.entity';
import { Quizs } from '../quizs/entities/quizs.entity';
import { QuizsCheckpoint } from '../quizs/entities/checkpoint.entity';
import { VideoAsset } from '../media-videos/entities/video.entity';
import { Level } from '../levels/entities/level.entity';
import { CoursesService } from '../courses/courses.service';

describe('LessonsService', () => {
  let service: LessonsService;

  type LessonRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    exist: jest.Mock;
    update: jest.Mock;
  };

  type ChapterRepoMock = {
    findOne: jest.Mock;
    update: jest.Mock;
  };

  type LevelRepoMock = {
    findOne: jest.Mock;
  };

  type ArticleRepoMock = {
    findOne: jest.Mock;
  };

  type QuizRepoMock = {
    findOne: jest.Mock;
  };

  type CheckpointRepoMock = {
    findOne: jest.Mock;
    exist: jest.Mock;
  };

  type VideoRepoMock = {
    findOne: jest.Mock;
  };

  let lessonRepo: LessonRepoMock;
  let chapterRepo: ChapterRepoMock;
  let levelRepo: LevelRepoMock;
  let articleRepo: ArticleRepoMock;
  let quizRepo: QuizRepoMock;
  let checkpointRepo: CheckpointRepoMock;
  let videoRepo: VideoRepoMock;

  const coursesServiceMock = {
    invalidateCourseCaches: jest.fn(),
  };

  const fixedNow = new Date('2026-03-05T00:00:00.000Z');

  const makeLesson = (overrides: Partial<Lesson> = {}): Lesson =>
    ({
      lesson_id: 1,
      lesson_title: 'T',
      lesson_description: null,
      lesson_type: LessonType.ARTICLE,
      orderIndex: 0,
      chapter_id: 10,
      lesson_ImageUrl: null as any,
      lesson_videoUrl: null as any,
      isPublished: false,
      createdAt: fixedNow,
      chapter: undefined as any,
      ...overrides,
    }) as Lesson;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            exist: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Chapter),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Article),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Quizs),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(QuizsCheckpoint),
          useValue: { findOne: jest.fn(), exist: jest.fn() },
        },
        {
          provide: getRepositoryToken(VideoAsset),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Level),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: CoursesService,
          useValue: coursesServiceMock,
        },
      ],
    }).compile();

    service = module.get(LessonsService);
    lessonRepo = module.get(getRepositoryToken(Lesson));
    chapterRepo = module.get(getRepositoryToken(Chapter));
    levelRepo = module.get(getRepositoryToken(Level));
    articleRepo = module.get(getRepositoryToken(Article));
    quizRepo = module.get(getRepositoryToken(Quizs));
    checkpointRepo = module.get(getRepositoryToken(QuizsCheckpoint));
    videoRepo = module.get(getRepositoryToken(VideoAsset));
    jest.clearAllMocks();

    // default syncChapterIsPublished path
    lessonRepo.exist!.mockResolvedValue(false);
    chapterRepo.update!.mockResolvedValue({} as any);
    chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10, levelId: 99 } as any);
    levelRepo.findOne!.mockResolvedValue({ level_id: 99, course_id: 123 } as any);
    coursesServiceMock.invalidateCourseCaches.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('throws when chapter not found', async () => {
      chapterRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({ chapter_id: 999, lesson_title: 'x', lesson_type: LessonType.ARTICLE } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('inserts non-checkpoint before existing checkpoint and shifts checkpoint down', async () => {
      chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10 } as any);

      const existingCheckpoint = makeLesson({ lesson_id: 2, lesson_type: LessonType.CHECKPOINT, orderIndex: 1 });
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1, orderIndex: 0 }), existingCheckpoint]);

      lessonRepo.save!.mockImplementation(async (l: any) => l);

      const newLesson = makeLesson({ lesson_id: 3, lesson_type: LessonType.ARTICLE, orderIndex: 1, isPublished: true });
      lessonRepo.create!.mockReturnValue(newLesson);

      (lessonRepo.save as jest.Mock)
        .mockResolvedValueOnce(existingCheckpoint) // save shifted checkpoint
        .mockResolvedValueOnce(newLesson); // save new lesson

      const result = await service.create({
        chapter_id: 10,
        lesson_title: 'New',
        lesson_type: LessonType.ARTICLE,
        isPublished: true,
      } as any);

      expect(existingCheckpoint.orderIndex).toBe(2);
      expect(result.orderIndex).toBe(1);
      expect(chapterRepo.update).toHaveBeenCalled();
    });

    it('replaces existing checkpoint when creating checkpoint (removes old, puts at end)', async () => {
      chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10 } as any);

      const existingCheckpoint = makeLesson({ lesson_id: 2, lesson_type: LessonType.CHECKPOINT, orderIndex: 1 });
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1, orderIndex: 0 }), existingCheckpoint]);

      lessonRepo.remove!.mockResolvedValue(existingCheckpoint);

      const checkpointLesson = makeLesson({ lesson_id: 3, lesson_type: LessonType.CHECKPOINT, orderIndex: 1, isPublished: false });
      lessonRepo.create!.mockReturnValue(checkpointLesson);
      lessonRepo.save!.mockResolvedValue(checkpointLesson);

      const result = await service.create({
        chapter_id: 10,
        lesson_title: 'CP',
        lesson_type: LessonType.CHECKPOINT,
      } as any);

      expect(lessonRepo.remove).toHaveBeenCalledWith(existingCheckpoint);
      expect(result.orderIndex).toBe(1);
      expect(result.isPublished).toBe(false);
    });

    it('creates checkpoint as last lesson when no existing checkpoint', async () => {
      chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10 } as any);

      lessonRepo.find!.mockResolvedValue([
        makeLesson({ lesson_id: 1, orderIndex: 0, lesson_type: LessonType.ARTICLE }),
        makeLesson({ lesson_id: 2, orderIndex: 1, lesson_type: LessonType.QUIZ }),
      ]);

      const checkpointLesson = makeLesson({
        lesson_id: 3,
        lesson_type: LessonType.CHECKPOINT,
        orderIndex: 2,
        isPublished: false,
      });
      lessonRepo.create!.mockReturnValue(checkpointLesson);
      lessonRepo.save!.mockResolvedValue(checkpointLesson);

      const result = await service.create({
        chapter_id: 10,
        lesson_title: 'CP',
        lesson_type: LessonType.CHECKPOINT,
        isPublished: true,
      } as any);

      expect(result.orderIndex).toBe(2);
      expect(result.isPublished).toBe(false);
    });

    it('creates non-checkpoint as last when no existing checkpoint', async () => {
      chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10 } as any);

      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1, orderIndex: 0 })]);
      lessonRepo.save!.mockImplementation(async (l: any) => l);

      const newLesson = makeLesson({
        lesson_id: 2,
        lesson_type: LessonType.VIDEO,
        orderIndex: 1,
        isPublished: false,
      });
      lessonRepo.create!.mockReturnValue(newLesson);
      lessonRepo.save!.mockResolvedValue(newLesson);

      const result = await service.create({
        chapter_id: 10,
        lesson_title: 'V',
        lesson_type: LessonType.VIDEO,
      } as any);

      expect(result.orderIndex).toBe(1);
      expect(result.isPublished).toBe(false);
      expect(chapterRepo.update).toHaveBeenCalled();
    });

    it('syncChapterIsPublished sets chapter.isPublished true when published lesson exists', async () => {
      chapterRepo.findOne!.mockResolvedValue({ chapter_id: 10 } as any);

      lessonRepo.find!.mockResolvedValue([]);
      lessonRepo.exist!.mockResolvedValue(true);

      const newLesson = makeLesson({
        lesson_id: 1,
        lesson_type: LessonType.VIDEO,
        orderIndex: 0,
        isPublished: true,
        lesson_videoUrl: 'https://cdn.skillacademy.com/videos/1.mp4',
      });
      lessonRepo.create!.mockReturnValue(newLesson);
      lessonRepo.save!.mockResolvedValue(newLesson);

      await service.create({
        chapter_id: 10,
        lesson_title: 'A',
        lesson_type: LessonType.VIDEO,
        lesson_videoUrl: 'https://cdn.skillacademy.com/videos/1.mp4',
        isPublished: true,
      } as any);

      expect(chapterRepo.update).toHaveBeenCalledWith(10, { isPublished: true });
    });
  });

  describe('findByChapter / findPublishedByChapter', () => {
    it('findByChapter maps list', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 })]);
      checkpointRepo.findOne!.mockResolvedValue(null);

      const result = await service.findByChapter(10);
      expect(lessonRepo.find).toHaveBeenCalledWith({ where: { chapter_id: 10 }, order: { orderIndex: 'ASC' } });
      expect(result).toHaveLength(1);
    });

    it('findPublishedByChapter filters isPublished', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1, isPublished: true })]);
      checkpointRepo.findOne!.mockResolvedValue(null);

      const result = await service.findPublishedByChapter(10);
      expect(lessonRepo.find).toHaveBeenCalledWith({
        where: { chapter_id: 10, isPublished: true },
        order: { orderIndex: 'ASC' },
      });
      expect(result[0].isPublished).toBe(true);
    });
  });

  describe('findAll / findAllPublished', () => {
    it('findAll returns list', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 })]);
      checkpointRepo.findOne!.mockResolvedValue(null);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('findAllPublished filters isPublished', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1, isPublished: true })]);
      checkpointRepo.findOne!.mockResolvedValue(null);
      const result = await service.findAllPublished();
      expect(lessonRepo.find).toHaveBeenCalledWith({ where: { isPublished: true }, order: { orderIndex: 'ASC' } });
      expect(result[0].isPublished).toBe(true);
    });
  });

  describe('findOne / findOnePublished / findOneAdmin', () => {
    it('findOne throws when lesson not found', async () => {
      lessonRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne throws when draft ARTICLE has no content', async () => {
      lessonRepo.findOne!.mockResolvedValue(makeLesson({ lesson_id: 1, lesson_type: LessonType.ARTICLE, isPublished: false }));
      articleRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne throws when draft QUIZ has no content', async () => {
      lessonRepo.findOne!.mockResolvedValue(makeLesson({ lesson_id: 1, lesson_type: LessonType.QUIZ, isPublished: false }));
      quizRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne throws when draft CHECKPOINT has no content', async () => {
      lessonRepo.findOne!.mockResolvedValue(
        makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT, isPublished: false }),
      );
      checkpointRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne returns dto for draft ARTICLE when content exists', async () => {
      lessonRepo.findOne!.mockResolvedValue(makeLesson({ lesson_id: 1, lesson_type: LessonType.ARTICLE, isPublished: false }));
      articleRepo.findOne!.mockResolvedValue({ article_id: 1 } as any);
      checkpointRepo.findOne!.mockResolvedValue(null);

      const result = await service.findOne(1);
      expect(result.lesson_id).toBe(1);
    });

    it('findOnePublished throws when not found', async () => {
      lessonRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOnePublished(1)).rejects.toBeInstanceOf(NotFoundException);

      expect(lessonRepo.findOne).toHaveBeenCalledWith({ where: { lesson_id: 1, isPublished: true } });
    });

    it('findOneAdmin returns dto', async () => {
      lessonRepo.findOne!.mockResolvedValue(makeLesson({ lesson_id: 1 }));
      checkpointRepo.findOne!.mockResolvedValue(null);
      const result = await service.findOneAdmin(1);
      expect(result.lesson_id).toBe(1);
    });

    it('findOne does not validate content when published', async () => {
      lessonRepo.findOne!.mockResolvedValue(makeLesson({ lesson_id: 1, lesson_type: LessonType.QUIZ, isPublished: true }));
      quizRepo.findOne!.mockResolvedValue(null);
      checkpointRepo.findOne!.mockResolvedValue(null);

      const result = await service.findOne(1);

      expect(result.lesson_id).toBe(1);
      expect(quizRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws when not found', async () => {
      lessonRepo.findOne!.mockResolvedValue(null);
      await expect(service.update(1, { lesson_title: 'x' } as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when trying to publish checkpoint without content', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT, isPublished: false });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      (checkpointRepo.exist as jest.Mock).mockResolvedValue(false);

      await expect(service.update(1, { isPublished: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps non-checkpoint unpublished by default when content is missing', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.ARTICLE, isPublished: false });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.save!.mockImplementation(async (l) => l as any);
      articleRepo.findOne!.mockResolvedValue(null);

      const result = await service.update(1, { lesson_title: 'New' } as any);

      expect(lesson.isPublished).toBe(false);
      expect(result.lesson_title).toBe('New');
      expect(chapterRepo.update).toHaveBeenCalled();
    });

    it('throws when trying to publish article without content', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.ARTICLE, isPublished: false });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      articleRepo.findOne!.mockResolvedValue(null);

      await expect(service.update(1, { isPublished: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('publishes video when video url exists', async () => {
      const lesson = makeLesson({
        lesson_id: 1,
        lesson_type: LessonType.VIDEO,
        lesson_videoUrl: 'https://cdn.skillacademy.com/videos/1.mp4',
        isPublished: false,
      });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.save!.mockImplementation(async (l) => l as any);

      const result = await service.update(1, { isPublished: true } as any);

      expect(result.isPublished).toBe(true);
    });

    it('converts lesson to CHECKPOINT, removes other checkpoint, moves to end, and forces draft', async () => {
      const lesson = makeLesson({
        lesson_id: 10,
        chapter_id: 99,
        lesson_type: LessonType.ARTICLE,
        isPublished: true,
        orderIndex: 0,
      });
      lessonRepo.findOne!.mockResolvedValue(lesson);

      const otherCheckpoint = makeLesson({
        lesson_id: 11,
        chapter_id: 99,
        lesson_type: LessonType.CHECKPOINT,
        orderIndex: 2,
      });

      lessonRepo.find!.mockResolvedValue([
        lesson,
        makeLesson({ lesson_id: 12, chapter_id: 99, orderIndex: 1 }),
        otherCheckpoint,
      ]);
      lessonRepo.remove!.mockResolvedValue(otherCheckpoint);
      lessonRepo.save!.mockImplementation(async (l) => l as any);
      checkpointRepo.exist!.mockResolvedValue(true);

      const result = await service.update(10, { lesson_type: LessonType.CHECKPOINT, isPublished: true } as any);

      expect(lessonRepo.remove).toHaveBeenCalledWith(otherCheckpoint);
      expect(result.lesson_type).toBe(LessonType.CHECKPOINT);
      expect(result.isPublished).toBe(false);
      expect(result.orderIndex).toBe(2);
    });

    it('publishes checkpoint when content exists', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT, isPublished: false });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.save!.mockImplementation(async (l) => l as any);
      checkpointRepo.exist!.mockResolvedValue(true);

      const result = await service.update(1, { isPublished: true } as any);

      expect(result.isPublished).toBe(true);
    });

    it('updates orderIndex for non-checkpoint when provided', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.ARTICLE, orderIndex: 0 });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.save!.mockImplementation(async (l) => l as any);

      const result = await service.update(1, { orderIndex: 5 } as any);

      expect(result.orderIndex).toBe(5);
    });

    it('ignores orderIndex update for checkpoint lessons', async () => {
      const lesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT, orderIndex: 0, isPublished: false });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.save!.mockImplementation(async (l) => l as any);
      checkpointRepo.exist!.mockResolvedValue(true);

      const result = await service.update(1, { orderIndex: 5 } as any);

      expect(result.orderIndex).toBe(0);
    });
  });

  describe('remove', () => {
    it('throws when not found', async () => {
      lessonRepo.findOne!.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes and syncs chapter publish state', async () => {
      const lesson = makeLesson({ lesson_id: 1, chapter_id: 10 });
      lessonRepo.findOne!.mockResolvedValue(lesson);
      lessonRepo.remove!.mockResolvedValue(lesson);

      const result = await service.remove(1);

      expect(lessonRepo.remove).toHaveBeenCalledWith(lesson);
      expect(chapterRepo.update).toHaveBeenCalledWith(10, { isPublished: false });
      expect(result.message).toContain('deleted successfully');
    });
  });

  describe('reorder', () => {
    it('returns [] when no lessons', async () => {
      lessonRepo.find!.mockResolvedValue([]);
      const result = await service.reorder(10, [1]);
      expect(result).toEqual([]);
    });

    it('throws when checkpoint is not last', async () => {
      const checkpoint = makeLesson({ lesson_id: 2, lesson_type: LessonType.CHECKPOINT });
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 }), checkpoint]);

      await expect(service.reorder(10, [2, 1])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when lessonIds missing/empty', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 })]);
      await expect(service.reorder(10, [] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when lessonIds not array', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 })]);
      await expect(service.reorder(10, null as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when lessonIds length mismatches', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 }), makeLesson({ lesson_id: 2 })]);
      await expect(service.reorder(10, [1] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when lesson id does not belong to chapter', async () => {
      lessonRepo.find!.mockResolvedValue([makeLesson({ lesson_id: 1 }), makeLesson({ lesson_id: 2 })]);
      await expect(service.reorder(10, [1, 999] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('saves updated order and returns findByChapter', async () => {
      const l1 = makeLesson({ lesson_id: 1, orderIndex: 0 });
      const l2 = makeLesson({ lesson_id: 2, orderIndex: 1 });
      lessonRepo.find!.mockResolvedValue([l1, l2]);
      lessonRepo.save!.mockResolvedValue([l1, l2] as any);

      jest.spyOn(service, 'findByChapter').mockResolvedValue([
        { lesson_id: 2 } as any,
        { lesson_id: 1 } as any,
      ]);

      const result = await service.reorder(10, [2, 1]);

      expect(lessonRepo.save).toHaveBeenCalledWith([expect.any(Object), expect.any(Object)]);
      expect(result[0].lesson_id).toBe(2);
    });
  });

  describe('toResponseDto (checkpoint enrichment)', () => {
    it('attaches checkpoint data when lesson is CHECKPOINT and checkpoint exists', async () => {
      const checkpointLesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT });
      lessonRepo.findOne!.mockResolvedValue(checkpointLesson);

      checkpointRepo.findOne!.mockResolvedValue({
        checkpointId: 99,
        checkpointScore: 5,
        checkpointType: 'mcq',
        checkpointQuestions: [],
        checkpointOption: [],
        checkpointExplanation: null,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      } as any);

      const result: any = await service.findOneAdmin(1);

      expect(result.checkpoint).toEqual(
        expect.objectContaining({ checkpoint_id: 99, checkpoint_score: 5, checkpoint_type: 'mcq' }),
      );
    });

    it('swallows errors from checkpointRepository.findOne', async () => {
      const checkpointLesson = makeLesson({ lesson_id: 1, lesson_type: LessonType.CHECKPOINT });
      lessonRepo.findOne!.mockResolvedValue(checkpointLesson);
      checkpointRepo.findOne!.mockRejectedValue(new Error('db down'));

      const result: any = await service.findOneAdmin(1);

      expect(result.lesson_id).toBe(1);
      expect(result.checkpoint).toBeUndefined();
    });
  });
});
