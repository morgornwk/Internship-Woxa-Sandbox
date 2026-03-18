import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { LessonType } from '../lessons/entities/lesson.entity';

describe('CoursesService', () => {
  let service: CoursesService;

  type CourseRepoMock = {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
  };

  let repo: CourseRepoMock;

  const fixedNow = new Date('2026-03-05T00:00:00.000Z');

  const makeCourse = (overrides: Partial<Course> = {}): Course =>
    ({
      course_id: 1,
      course_ownerId: 9,
      course_title: 'T',
      course_description: 'D',
      course_imageUrl: null as any,
      course_tags: null as any,
      isPublished: false,
      course_totalChapter: 0,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      course_levels: [],
      ...overrides,
    }) as Course;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getRepositoryToken(Course),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CoursesService);
    repo = module.get(getRepositoryToken(Course));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates and returns response dto', async () => {
      const created = makeCourse({ course_title: 'C1', course_ownerId: 0 });
      const saved = makeCourse({ ...created, course_id: 123 });

      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(saved);

      const result = await service.create({
        course_title: 'C1',
        course_description: 'Desc',
        course_imageUrl: undefined,
        course_ownerId: undefined,
        course_tags: undefined,
        isPublished: undefined,
      } as any);

      expect(repo.create).toHaveBeenCalledWith({
        course_ownerId: 0,
        course_title: 'C1',
        course_description: 'Desc',
        course_imageUrl: undefined,
        course_tags: null,
        isPublished: false,
      });
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result.course_id).toBe(123);
      expect(result.course_title).toBe('C1');
      expect(result.course_totalChapter).toBe(0);
    });
  });

  describe('findAll', () => {
    it('applies filters, pagination, and maps course_totalChapter from raw', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [makeCourse({ course_id: 1 })],
          raw: [{ course_totalChapter: '7' }],
        }),
      };

      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        isPublished: true,
        course_ownerId: 9,
        search: 'HELLO',
        limit: 10,
        offset: 5,
      });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('course');
      expect(qb.addSelect).toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalled();
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(result[0].course_totalChapter).toBe(7);
    });

    it('does not apply filters when params omitted and clamps limit to max 100', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [makeCourse({ course_id: 1 })],
          raw: [{}],
        }),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 9999 });

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.take).toHaveBeenCalledWith(100);
      expect(qb.skip).toHaveBeenCalledWith(0);
    });

    it('uses case-insensitive search keyword and coerces invalid total to 0', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [makeCourse({ course_id: 1 })],
          raw: [{ course_totalChapter: 'not-a-number' }],
        }),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ search: 'HeLLo' });

      const searchCall = (qb.andWhere as jest.Mock).mock.calls.find(
        (c: any[]) =>
          String(c?.[0] ?? '').includes('LOWER(course.course_title)'),
      );
      expect(searchCall?.[1]).toEqual({ kw: '%hello%' });
      expect(result[0].course_totalChapter).toBe(0);
    });

    it('clamps default limit/offset when invalid', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getRawAndEntities: jest
          .fn()
          .mockResolvedValue({ entities: [], raw: [] }),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: -1, offset: -10 });

      expect(qb.take).toHaveBeenCalledWith(50);
      expect(qb.skip).toHaveBeenCalledWith(0);
    });
  });

  describe('findOne', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns dto when found', async () => {
      repo.findOne.mockResolvedValue(
        makeCourse({ course_id: 1, course_totalChapter: 2 }),
      );
      const result = await service.findOne(1);
      expect(result.course_id).toBe(1);
      expect(result.course_totalChapter).toBe(2);
    });
  });

  describe('getStructure', () => {
    it('throws when course not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getStructure(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns nested structure with published lessons only', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 10,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 100,
                chapter_title: 'C1',
                chapter_orderIndex: 0,
                lessons: [
                  {
                    lesson_id: 1000,
                    lesson_title: 'A',
                    lesson_type: LessonType.ARTICLE,
                    lesson_description: 'x',
                    orderIndex: 0,
                    isPublished: true,
                  },
                  {
                    lesson_id: 1001,
                    lesson_title: 'Draft',
                    lesson_type: LessonType.ARTICLE,
                    lesson_description: 'y',
                    orderIndex: 1,
                    isPublished: false,
                  },
                  {
                    lesson_id: 1002,
                    lesson_title: 'CP',
                    lesson_type: LessonType.CHECKPOINT,
                    lesson_description: null,
                    orderIndex: 2,
                    isPublished: true,
                  },
                ],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructure(1);

      expect(result.course_levels).toHaveLength(1);
      expect(result.course_levels[0].chapters).toHaveLength(1);
      const lessons = result.course_levels[0].chapters[0].lessons;
      expect(lessons.map((l) => l.lesson_id)).toEqual([1000, 1002]);
    });

    it('treats video lessons with a URL as published in course structure responses', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 10,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 100,
                chapter_title: 'C1',
                chapter_orderIndex: 0,
                lessons: [
                  {
                    lesson_id: 1008,
                    lesson_title: 'Video lesson',
                    lesson_type: LessonType.VIDEO,
                    lesson_description: '',
                    lesson_videoUrl:
                      'https://cdn.skllracademy.com/videos/video-1.mp4',
                    orderIndex: 0,
                    isPublished: false,
                  },
                ],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructure(1);

      expect(result.course_levels[0].chapters[0].lessons).toEqual([
        expect.objectContaining({
          lesson_id: 1008,
          lesson_type: LessonType.VIDEO,
          isPublished: true,
        }),
      ]);
    });

    it('sorts levels/chapters/lessons and filters out empty chapters/levels', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 2,
            level_title: 'L2',
            level_orderIndex: 1,
            level_chapters: [
              {
                chapter_id: 21,
                chapter_title: 'C21',
                chapter_orderIndex: 0,
                lessons: [
                  {
                    lesson_id: 2101,
                    lesson_title: 'Draft',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 0,
                    isPublished: false,
                  },
                ],
              },
            ],
          },
          {
            level_id: 1,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 12,
                chapter_title: 'C12',
                chapter_orderIndex: 1,
                lessons: [
                  {
                    lesson_id: 1202,
                    lesson_title: 'B',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 1,
                    isPublished: true,
                  },
                  {
                    lesson_id: 1201,
                    lesson_title: 'A',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 0,
                    isPublished: true,
                  },
                ],
              },
              {
                chapter_id: 11,
                chapter_title: 'C11',
                chapter_orderIndex: 0,
                lessons: [],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructure(1);

      expect(result.course_levels.map((l) => l.level_id)).toEqual([1]);
      expect(result.course_levels[0].chapters.map((c) => c.chapter_id)).toEqual(
        [12],
      );
      expect(
        result.course_levels[0].chapters[0].lessons.map((l) => l.lesson_id),
      ).toEqual([1201, 1202]);
    });

    it('returns empty array when course has no lessons', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 1,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 1,
                chapter_title: 'C1',
                chapter_orderIndex: 0,
                lessons: [],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructure(1);

      expect(result.course_levels).toEqual([]);
    });
  });

  describe('getStructureAdmin', () => {
    it('throws when course not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getStructureAdmin(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns nested structure including unpublished lessons', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 10,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 100,
                chapter_title: 'C1',
                chapter_orderIndex: 0,
                lessons: [
                  {
                    lesson_id: 1000,
                    lesson_title: 'A',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 0,
                    isPublished: false,
                  },
                ],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructureAdmin(1);

      expect(result.course_levels[0].chapters[0].lessons).toHaveLength(1);
      expect(result.course_levels[0].chapters[0].lessons[0].lesson_id).toBe(
        1000,
      );
    });

    it('sorts lessons by orderIndex', async () => {
      const course = makeCourse({
        course_id: 1,
        course_levels: [
          {
            level_id: 10,
            level_title: 'L1',
            level_orderIndex: 0,
            level_chapters: [
              {
                chapter_id: 100,
                chapter_title: 'C1',
                chapter_orderIndex: 0,
                lessons: [
                  {
                    lesson_id: 2,
                    lesson_title: 'B',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 1,
                    isPublished: false,
                  },
                  {
                    lesson_id: 1,
                    lesson_title: 'A',
                    lesson_type: LessonType.ARTICLE,
                    orderIndex: 0,
                    isPublished: false,
                  },
                ],
              },
            ],
          },
        ] as any,
      });

      repo.findOne.mockResolvedValue(course);

      const result = await service.getStructureAdmin(1);
      expect(
        result.course_levels[0].chapters[0].lessons.map((l) => l.lesson_id),
      ).toEqual([1, 2]);
    });
  });

  describe('update', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(1, { course_title: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates fields and returns dto', async () => {
      const course = makeCourse({ course_id: 1, course_title: 'Old' });
      repo.findOne.mockResolvedValue(course);
      repo.save.mockImplementation(async (c) => c);

      const result = await service.update(1, {
        course_title: 'New',
        isPublished: true,
      } as any);

      expect(course.course_title).toBe('New');
      expect(course.isPublished).toBe(true);
      expect(result.course_title).toBe('New');
    });

    it('allows setting nullable fields to null and maps nulls to undefined in response dto', async () => {
      const course = makeCourse({
        course_id: 1,
        course_imageUrl: 'x',
        course_tags: ['a'] as any,
      });
      repo.findOne.mockResolvedValue(course);
      repo.save.mockImplementation(async (c) => c);

      const result = await service.update(1, {
        course_imageUrl: null,
        course_tags: null,
      } as any);

      expect(course.course_imageUrl).toBeNull();
      expect(course.course_tags).toBeNull();
      expect(result.course_imageUrl).toBeUndefined();
      expect(result.course_tags).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes and returns message', async () => {
      const course = makeCourse({ course_id: 1 });
      repo.findOne.mockResolvedValue(course);
      repo.remove.mockResolvedValue(course);

      const result = await service.remove(1);

      expect(repo.remove).toHaveBeenCalledWith(course);
      expect(result.message).toContain('deleted successfully');
    });
  });
});
