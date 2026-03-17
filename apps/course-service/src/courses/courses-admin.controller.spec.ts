import { Test, TestingModule } from '@nestjs/testing';

import { AdminCoursesController } from './courses-admin.controller';
import { CoursesService } from './courses.service';

describe('AdminCoursesController', () => {
  let controller: AdminCoursesController;
  let coursesService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            getStructureAdmin: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminCoursesController);
    coursesService = module.get(CoursesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('delegates to CoursesService.create', async () => {
      coursesService.create.mockResolvedValue({ course_id: 1 } as any);
      await expect(
        controller.create({ course_title: 't' } as any),
      ).resolves.toEqual({
        course_id: 1,
      });
      expect(coursesService.create).toHaveBeenCalledWith({ course_title: 't' });
    });

    it('propagates errors from CoursesService.create', async () => {
      coursesService.create.mockRejectedValue(new Error('boom'));
      await expect(controller.create({} as any)).rejects.toThrow('boom');
    });
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
      coursesService.findOne.mockResolvedValue({ course_id: 123 } as any);
      await expect(controller.findOne(123)).resolves.toEqual({
        course_id: 123,
      });
      expect(coursesService.findOne).toHaveBeenCalledWith(123);
    });

    it('propagates errors from CoursesService.findOne', async () => {
      coursesService.findOne.mockRejectedValue(new Error('not found'));
      await expect(controller.findOne(1)).rejects.toThrow('not found');
    });
  });

  describe('getStructure', () => {
    it('delegates to CoursesService.getStructureAdmin', async () => {
      coursesService.getStructureAdmin.mockResolvedValue({
        course_id: 5,
      } as any);
      await expect(controller.getStructure(5)).resolves.toEqual({
        course_id: 5,
      });
      expect(coursesService.getStructureAdmin).toHaveBeenCalledWith(5);
    });

    it('propagates errors from CoursesService.getStructureAdmin', async () => {
      coursesService.getStructureAdmin.mockRejectedValue(new Error('boom'));
      await expect(controller.getStructure(1)).rejects.toThrow('boom');
    });
  });

  describe('update', () => {
    it('delegates to CoursesService.update', async () => {
      coursesService.update.mockResolvedValue({
        course_id: 7,
        course_title: 'n',
      } as any);
      await expect(
        controller.update(7, { course_title: 'n' } as any),
      ).resolves.toEqual({
        course_id: 7,
        course_title: 'n',
      });
      expect(coursesService.update).toHaveBeenCalledWith(7, {
        course_title: 'n',
      });
    });

    it('propagates errors from CoursesService.update', async () => {
      coursesService.update.mockRejectedValue(new Error('boom'));
      await expect(controller.update(1, {} as any)).rejects.toThrow('boom');
    });
  });

  describe('remove', () => {
    it('delegates to CoursesService.remove', async () => {
      coursesService.remove.mockResolvedValue({ message: 'ok' });
      await expect(controller.remove(9)).resolves.toEqual({ message: 'ok' });
      expect(coursesService.remove).toHaveBeenCalledWith(9);
    });

    it('propagates errors from CoursesService.remove', async () => {
      coursesService.remove.mockRejectedValue(new Error('boom'));
      await expect(controller.remove(1)).rejects.toThrow('boom');
    });
  });
});
