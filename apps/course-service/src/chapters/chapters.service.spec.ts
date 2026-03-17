import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChaptersService } from './chapters.service';
import { Chapter } from './entities/chapter.entity';
import { Level } from '../levels/entities/level.entity';
import { CoursesService } from '../courses/courses.service';

describe('ChaptersService', () => {
  let service: ChaptersService;

  type ChapterRepoMock = {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  type LevelRepoMock = {
    findOne: jest.Mock;
  };

  let chapterRepo: ChapterRepoMock;
  let levelRepo: LevelRepoMock;

  const fixedNow = new Date('2026-03-05T00:00:00.000Z');

  const makeChapter = (overrides: Partial<Chapter> = {}): Chapter =>
    ({
      chapter_id: 1,
      chapter_title: 'Intro',
      chapter_name: 'intro',
      chapter_orderIndex: 0,
      isPublished: false,
      levelId: 10,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      lessons: [],
      level: undefined as any,
      ...overrides,
    }) as Chapter;

  const toDto = (chapter: Chapter) => ({
    chapter_id: chapter.chapter_id,
    chapter_title: chapter.chapter_title,
    chapter_name: chapter.chapter_name,
    isPublished: chapter.isPublished,
    chapter_orderIndex: chapter.chapter_orderIndex,
    level_id: chapter.levelId,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChaptersService,
        {
          provide: getRepositoryToken(Chapter),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Level),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CoursesService,
          useValue: {
            invalidateCourseCaches: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ChaptersService);
    chapterRepo = module.get(getRepositoryToken(Chapter));
    levelRepo = module.get(getRepositoryToken(Level));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws NotFoundException when level not found', async () => {
      levelRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({
          chapter_title: 'C1',
          chapter_name: 'c1',
          level_id: 999,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(levelRepo.findOne).toHaveBeenCalledWith({ where: { level_id: 999 } });
    });

    it('uses provided chapter_orderIndex when given (no MAX query)', async () => {
      levelRepo.findOne!.mockResolvedValue({ level_id: 10 } as Level);

      const created = makeChapter({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 7,
      });
      const saved = makeChapter({ ...created, chapter_id: 123 });

      chapterRepo.create!.mockReturnValue(created);
      chapterRepo.save!.mockResolvedValue(saved);

      const result = await service.create({
        chapter_title: 'C1',
        chapter_name: 'c1',
        level_id: 10,
        chapter_orderIndex: 7,
      });

      expect(chapterRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(chapterRepo.create).toHaveBeenCalledWith({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 7,
      });
      expect(result).toEqual(toDto(saved));
    });

    it('auto-assigns orderIndex = max + 1 when chapter_orderIndex not provided', async () => {
      levelRepo.findOne!.mockResolvedValue({ level_id: 10 } as Level);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxOrder: '4' }),
      };
      chapterRepo.createQueryBuilder!.mockReturnValue(mockQB as any);

      const created = makeChapter({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 5,
      });
      const saved = makeChapter({ ...created, chapter_id: 123 });

      chapterRepo.create!.mockReturnValue(created);
      chapterRepo.save!.mockResolvedValue(saved);

      const result = await service.create({
        chapter_title: 'C1',
        chapter_name: 'c1',
        level_id: 10,
      });

      expect(chapterRepo.createQueryBuilder).toHaveBeenCalledWith('chapter');
      expect(mockQB.where).toHaveBeenCalledWith('chapter.level_id = :levelId', { levelId: 10 });
      expect(mockQB.select).toHaveBeenCalledWith('MAX(chapter.order_index)', 'maxOrder');

      expect(chapterRepo.create).toHaveBeenCalledWith({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 5,
      });

      expect(result.chapter_orderIndex).toBe(5);
    });

    it('auto-assigns orderIndex = 0 when no chapters exist in level (MAX null)', async () => {
      levelRepo.findOne!.mockResolvedValue({ level_id: 10 } as Level);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxOrder: null }),
      };
      chapterRepo.createQueryBuilder!.mockReturnValue(mockQB as any);

      const created = makeChapter({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 0,
      });
      const saved = makeChapter({ ...created, chapter_id: 123 });

      chapterRepo.create!.mockReturnValue(created);
      chapterRepo.save!.mockResolvedValue(saved);

      const result = await service.create({
        chapter_title: 'C1',
        chapter_name: 'c1',
        level_id: 10,
      });

      expect(chapterRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ chapter_orderIndex: 0 }),
      );
      expect(result.chapter_orderIndex).toBe(0);
    });

    it('auto-assigns orderIndex = 0 when MAX query returns undefined', async () => {
      levelRepo.findOne!.mockResolvedValue({ level_id: 10 } as Level);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(undefined),
      };
      chapterRepo.createQueryBuilder!.mockReturnValue(mockQB as any);

      const created = makeChapter({
        chapter_title: 'C1',
        chapter_name: 'c1',
        levelId: 10,
        chapter_orderIndex: 0,
      });
      chapterRepo.create!.mockReturnValue(created);
      chapterRepo.save!.mockResolvedValue(created);

      const result = await service.create({
        chapter_title: 'C1',
        chapter_name: 'c1',
        level_id: 10,
      });

      expect(result.chapter_orderIndex).toBe(0);
    });
  });

  describe('findByLevel / findByLevelStudent', () => {
    it('findByLevel queries all chapters in level ordered by orderIndex', async () => {
      chapterRepo.find!.mockResolvedValue([
        makeChapter({ chapter_id: 1, chapter_orderIndex: 0, levelId: 10 }),
        makeChapter({ chapter_id: 2, chapter_orderIndex: 1, levelId: 10 }),
      ]);

      const result = await service.findByLevel(10);

      expect(chapterRepo.find).toHaveBeenCalledWith({
        where: { levelId: 10 },
        order: { chapter_orderIndex: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].level_id).toBe(10);
    });

    it('findByLevelStudent filters only published chapters', async () => {
      chapterRepo.find!.mockResolvedValue([makeChapter({ isPublished: true, levelId: 10 })]);

      const result = await service.findByLevelStudent(10);

      expect(chapterRepo.find).toHaveBeenCalledWith({
        where: { levelId: 10, isPublished: true },
        order: { chapter_orderIndex: 'ASC' },
      });
      expect(result[0].isPublished).toBe(true);
    });
  });

  describe('findAll / findAllStudent', () => {
    it('findAll queries all chapters ordered by orderIndex', async () => {
      chapterRepo.find!.mockResolvedValue([makeChapter({ chapter_id: 1 }), makeChapter({ chapter_id: 2 })]);

      const result = await service.findAll();

      expect(chapterRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { chapter_orderIndex: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('findAllStudent filters only published', async () => {
      chapterRepo.find!.mockResolvedValue([makeChapter({ isPublished: true })]);

      const result = await service.findAllStudent();

      expect(chapterRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true },
        order: { chapter_orderIndex: 'ASC' },
      });
      expect(result[0].isPublished).toBe(true);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when chapter not found', async () => {
      chapterRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne(123)).rejects.toBeInstanceOf(NotFoundException);
      expect(chapterRepo.findOne).toHaveBeenCalledWith({ where: { chapter_id: 123 } });
    });

    it('returns response dto when chapter found', async () => {
      const chapter = makeChapter({ chapter_id: 123, levelId: 10 });
      chapterRepo.findOne!.mockResolvedValue(chapter);

      await expect(service.findOne(123)).resolves.toEqual(toDto(chapter));
    });
  });

  describe('findOneStudent', () => {
    it('throws NotFoundException when chapter not found', async () => {
      chapterRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOneStudent(123)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when chapter is not published', async () => {
      chapterRepo.findOne!.mockResolvedValue(makeChapter({ chapter_id: 123, isPublished: false }));

      await expect(service.findOneStudent(123)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns response dto when chapter is published', async () => {
      chapterRepo.findOne!.mockResolvedValue(makeChapter({ chapter_id: 123, isPublished: true, levelId: 10 }));

      const result = await service.findOneStudent(123);

      expect(result.chapter_id).toBe(123);
      expect(result.isPublished).toBe(true);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when chapter not found', async () => {
      chapterRepo.findOne!.mockResolvedValue(null);

      await expect(service.update(123, { chapter_title: 'New' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates only provided fields and saves', async () => {
      const chapter = makeChapter({
        chapter_id: 123,
        chapter_title: 'Old Title',
        chapter_name: 'old-name',
        chapter_orderIndex: 1,
      });

      chapterRepo.findOne!.mockResolvedValue(chapter);
      chapterRepo.save!.mockImplementation(async (c) => c as any);

      const result = await service.update(123, {
        chapter_title: 'New Title',
        chapter_orderIndex: 5,
      });

      expect(chapter.chapter_title).toBe('New Title');
      expect(chapter.chapter_name).toBe('old-name');
      expect(chapter.chapter_orderIndex).toBe(5);

      expect(chapterRepo.save).toHaveBeenCalledWith(chapter);
      expect(result.chapter_title).toBe('New Title');
      expect(result.chapter_orderIndex).toBe(5);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when chapter not found', async () => {
      chapterRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove(123)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes chapter and returns message', async () => {
      const chapter = makeChapter({ chapter_id: 123 });
      chapterRepo.findOne!.mockResolvedValue(chapter);
      chapterRepo.remove!.mockResolvedValue(chapter);

      const result = await service.remove(123);

      expect(chapterRepo.remove).toHaveBeenCalledWith(chapter);
      expect(result).toEqual({ message: 'Chapter with ID 123 deleted successfully' });
    });
  });

  describe('reorder', () => {
    it('returns [] when no chapters in level', async () => {
      chapterRepo.find!.mockResolvedValue([]);

      const result = await service.reorder(10, [1, 2]);

      expect(result).toEqual([]);
    });

    it.each([
      {
        title: 'throws when chapter_ids is missing/empty',
        chapters: [makeChapter({ chapter_id: 1, levelId: 10 })],
        ids: [] as any,
      },
      {
        title: 'throws when chapter_ids is not an array',
        chapters: [makeChapter({ chapter_id: 1, levelId: 10 })],
        ids: null as any,
      },
      {
        title: 'throws when chapter_ids length mismatches',
        chapters: [makeChapter({ chapter_id: 1, levelId: 10 }), makeChapter({ chapter_id: 2, levelId: 10 })],
        ids: [1],
      },
      {
        title: 'throws when chapter id does not belong to level',
        chapters: [makeChapter({ chapter_id: 1, levelId: 10 }), makeChapter({ chapter_id: 2, levelId: 10 })],
        ids: [1, 999],
      },
      {
        title: 'throws when chapter_ids contains duplicates (missing some chapters)',
        chapters: [
          makeChapter({ chapter_id: 1, levelId: 10 }),
          makeChapter({ chapter_id: 2, levelId: 10 }),
          makeChapter({ chapter_id: 3, levelId: 10 }),
        ],
        ids: [1, 1, 2],
      },
    ])('$title', async ({ chapters, ids }) => {
      chapterRepo.find!.mockResolvedValue(chapters as any);

      await expect(service.reorder(10, ids as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates orderIndex and returns chapters in new order', async () => {
      const ch1 = makeChapter({ chapter_id: 1, levelId: 10, chapter_orderIndex: 0 });
      const ch2 = makeChapter({ chapter_id: 2, levelId: 10, chapter_orderIndex: 1 });

      chapterRepo.find!.mockResolvedValue([ch1, ch2]);
      chapterRepo.save!.mockImplementation(async (c) => c as any);

      const expected = [
        toDto({ ...ch2, chapter_orderIndex: 0 }),
        toDto({ ...ch1, chapter_orderIndex: 1 }),
      ];

      jest.spyOn(service, 'findByLevel').mockResolvedValue(expected);

      const result = await service.reorder(10, [2, 1]);

      expect(ch2.chapter_orderIndex).toBe(0);
      expect(ch1.chapter_orderIndex).toBe(1);
      expect(chapterRepo.save).toHaveBeenCalledTimes(2);
      expect(service.findByLevel).toHaveBeenCalledWith(10);
      expect(result).toEqual(expected);
    });
  });
});
