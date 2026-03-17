import { Test, TestingModule } from '@nestjs/testing';

import { StudentCoursesController } from './courses-student.controller';
import { CoursesService } from './courses.service';

describe('StudentCoursesController', () => {
  let controller: StudentCoursesController;
  let coursesService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentCoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            getStructure: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(StudentCoursesController);
    coursesService = module.get(CoursesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to CoursesService.findAll', async () => {
      coursesService.findAll.mockResolvedValue([{ course_id: 1 } as any]);
      await expect(controller.findAll()).resolves.toEqual([{ course_id: 1 }]);
      expect(coursesService.findAll).toHaveBeenCalledWith();
    });

    it('propagates errors from CoursesService.findAll', async () => {
      coursesService.findAll.mockRejectedValue(new Error('boom'));
      await expect(controller.findAll()).rejects.toThrow('boom');
    });
  });

  describe('findOne', () => {
    it('delegates to CoursesService.findOne', async () => {
      coursesService.findOne.mockResolvedValue({ course_id: 2 } as any);
      await expect(controller.findOne(2)).resolves.toEqual({ course_id: 2 });
      expect(coursesService.findOne).toHaveBeenCalledWith(2);
    });

    it('propagates errors from CoursesService.findOne', async () => {
      coursesService.findOne.mockRejectedValue(new Error('boom'));
      await expect(controller.findOne(1)).rejects.toThrow('boom');
    });
  });

  describe('getStructure', () => {
    it('delegates to CoursesService.getStructure', async () => {
      coursesService.getStructure.mockResolvedValue({ course_id: 3 } as any);
      await expect(controller.getStructure(3)).resolves.toEqual({
        course_id: 3,
      });
      expect(coursesService.getStructure).toHaveBeenCalledWith(3);
    });

    it('propagates errors from CoursesService.getStructure', async () => {
      coursesService.getStructure.mockRejectedValue(new Error('boom'));
      await expect(controller.getStructure(1)).rejects.toThrow('boom');
    });
  });
});
