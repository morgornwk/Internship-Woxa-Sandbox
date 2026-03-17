import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LevelsService } from './levels.service';
import { Level } from './entities/level.entity';
import { Course } from '../courses/entities/course.entity';
import { CoursesService } from '../courses/courses.service';

describe('LevelsService', () => {
  let service: LevelsService;

  type LevelRepoMock = {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  type CourseRepoMock = {
    findOne: jest.Mock;
  };

  let levelRepo: LevelRepoMock;
  let courseRepo: CourseRepoMock;

  const makeLevel = (overrides: Partial<Level> = {}): Level =>
    ({
      level_id: 1,
      level_title: 'L',
      level_orderIndex: 0,
      course_id: 10,
      course: undefined as any,
      level_chapters: [],
      ...overrides,
    }) as Level;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LevelsService,
        {
          provide: getRepositoryToken(Level),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Course),
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

    service = module.get(LevelsService);
    levelRepo = module.get(getRepositoryToken(Level));
    courseRepo = module.get(getRepositoryToken(Course));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws when course not found', async () => {
      courseRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({ level_title: 'L1', course_id: 999 } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('uses provided orderIndex when given (no MAX query)', async () => {
      courseRepo.findOne.mockResolvedValue({ course_id: 10 } as any);

      const level = makeLevel({ level_title: 'L1', course_id: 10, level_orderIndex: 7 });
      levelRepo.create.mockReturnValue(level);
      levelRepo.save.mockResolvedValue(level);

      const result = await service.create({ level_title: 'L1', course_id: 10, level_orderIndex: 7 } as any);

      expect(levelRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.level_orderIndex).toBe(7);
    });

    it('auto-assigns orderIndex = max + 1 when not provided', async () => {
      courseRepo.findOne.mockResolvedValue({ course_id: 10 } as any);

      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxOrder: 2 }),
      };
      levelRepo.createQueryBuilder.mockReturnValue(qb as any);

      const level = makeLevel({ level_title: 'L1', course_id: 10, level_orderIndex: 3 });
      levelRepo.create.mockReturnValue(level);
      levelRepo.save.mockResolvedValue(level);

      const result = await service.create({ level_title: 'L1', course_id: 10 } as any);

      expect(result.level_orderIndex).toBe(3);
    });

    it('auto-assigns orderIndex = 0 when MAX is null', async () => {
      courseRepo.findOne.mockResolvedValue({ course_id: 10 } as any);

      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxOrder: null }),
      };
      levelRepo.createQueryBuilder.mockReturnValue(qb as any);

      const level = makeLevel({ level_title: 'L1', course_id: 10, level_orderIndex: 0 });
      levelRepo.create.mockReturnValue(level);
      levelRepo.save.mockResolvedValue(level);

      const result = await service.create({ level_title: 'L1', course_id: 10 } as any);

      expect(result.level_orderIndex).toBe(0);
    });

    it('auto-assigns orderIndex = 0 when MAX query returns undefined', async () => {
      courseRepo.findOne.mockResolvedValue({ course_id: 10 } as any);

      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(undefined),
      };
      levelRepo.createQueryBuilder.mockReturnValue(qb as any);

      const level = makeLevel({ level_title: 'L1', course_id: 10, level_orderIndex: 0 });
      levelRepo.create.mockReturnValue(level);
      levelRepo.save.mockResolvedValue(level);

      const result = await service.create({ level_title: 'L1', course_id: 10 } as any);

      expect(result.level_orderIndex).toBe(0);
    });
  });

  describe('findByCourse', () => {
    it('returns mapped dto list', async () => {
      levelRepo.find.mockResolvedValue([makeLevel({ level_id: 1 }), makeLevel({ level_id: 2 })]);

      const result = await service.findByCourse(10);

      expect(levelRepo.find).toHaveBeenCalledWith({ where: { course_id: 10 }, order: { level_orderIndex: 'ASC' } });
      expect(result).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('returns mapped dto list', async () => {
      levelRepo.find.mockResolvedValue([makeLevel({ level_id: 1 })]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws when not found', async () => {
      levelRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns dto when found', async () => {
      levelRepo.findOne.mockResolvedValue(makeLevel({ level_id: 1 }));
      const result = await service.findOne(1);
      expect(result.level_id).toBe(1);
    });
  });

  describe('update', () => {
    it('throws when not found', async () => {
      levelRepo.findOne.mockResolvedValue(null);
      await expect(service.update(1, { level_title: 'x' } as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates fields and saves', async () => {
      const level = makeLevel({ level_id: 1, level_title: 'Old', level_orderIndex: 0 });
      levelRepo.findOne.mockResolvedValue(level);
      levelRepo.save.mockImplementation(async (l) => l as any);

      const result = await service.update(1, { level_title: 'New', level_orderIndex: 2 } as any);

      expect(level.level_title).toBe('New');
      expect(level.level_orderIndex).toBe(2);
      expect(result.level_title).toBe('New');
    });
  });

  describe('remove', () => {
    it('throws when not found', async () => {
      levelRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes and returns message', async () => {
      const level = makeLevel({ level_id: 1 });
      levelRepo.findOne.mockResolvedValue(level);
      levelRepo.remove.mockResolvedValue(level);

      const result = await service.remove(1);

      expect(levelRepo.remove).toHaveBeenCalledWith(level);
      expect(result.message).toContain('deleted successfully');
    });
  });

  describe('reorder', () => {
    it('returns [] when no levels', async () => {
      levelRepo.find.mockResolvedValue([]);
      const result = await service.reorder(10, [1]);
      expect(result).toEqual([]);
    });

    it('throws when levelIds missing', async () => {
      levelRepo.find.mockResolvedValue([makeLevel({ level_id: 1, course_id: 10 })]);
      await expect(service.reorder(10, [] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when levelIds is not an array', async () => {
      levelRepo.find.mockResolvedValue([makeLevel({ level_id: 1, course_id: 10 })]);
      await expect(service.reorder(10, null as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when levelIds length mismatches levels length', async () => {
      levelRepo.find.mockResolvedValue([
        makeLevel({ level_id: 1, course_id: 10 }),
        makeLevel({ level_id: 2, course_id: 10 }),
      ]);
      await expect(service.reorder(10, [1] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when ids include other course', async () => {
      levelRepo.find.mockResolvedValue([makeLevel({ level_id: 1, course_id: 10 })]);
      await expect(service.reorder(10, [999])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when levelIds contains duplicates (missing some levels)', async () => {
      levelRepo.find.mockResolvedValue([
        makeLevel({ level_id: 1, course_id: 10 }),
        makeLevel({ level_id: 2, course_id: 10 }),
        makeLevel({ level_id: 3, course_id: 10 }),
      ]);
      await expect(service.reorder(10, [1, 1, 2] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates orderIndex and returns findByCourse', async () => {
      const l1 = makeLevel({ level_id: 1, course_id: 10, level_orderIndex: 0 });
      const l2 = makeLevel({ level_id: 2, course_id: 10, level_orderIndex: 1 });
      levelRepo.find.mockResolvedValue([l1, l2]);
      levelRepo.save.mockImplementation(async (l) => l as any);

      jest.spyOn(service, 'findByCourse').mockResolvedValue([
        { level_id: 2 } as any,
        { level_id: 1 } as any,
      ]);

      const result = await service.reorder(10, [2, 1]);

      expect(levelRepo.save).toHaveBeenCalledTimes(2);
      expect(result[0].level_id).toBe(2);
    });
  });
});
