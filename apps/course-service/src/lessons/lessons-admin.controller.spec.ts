import { Test, TestingModule } from '@nestjs/testing';

import { LessonsAdminController } from './lessons-admin.controller';
import { LessonsService } from './lessons.service';

describe('LessonsAdminController', () => {
  let controller: LessonsAdminController;
  let lessonsService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonsAdminController],
      providers: [
        {
          provide: LessonsService,
          useValue: {
            create: jest.fn(),
            findByChapter: jest.fn(),
            findAll: jest.fn(),
            findOneAdmin: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            reorder: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LessonsAdminController);
    lessonsService = module.get(LessonsService);
    jest.clearAllMocks();
  });

  it('create delegates to LessonsService.create', async () => {
    lessonsService.create.mockResolvedValue({ lesson_id: 1 } as any);
    await expect(
      controller.create({ lesson_title: 'T' } as any),
    ).resolves.toEqual({ lesson_id: 1 });
    expect(lessonsService.create).toHaveBeenCalledWith({ lesson_title: 'T' });
  });

  it('findByChapter delegates to LessonsService.findByChapter', async () => {
    lessonsService.findByChapter.mockResolvedValue([{ lesson_id: 1 } as any]);
    await expect(controller.findByChapter(10)).resolves.toEqual([
      { lesson_id: 1 },
    ]);
    expect(lessonsService.findByChapter).toHaveBeenCalledWith(10);
  });

  it('findAll delegates to LessonsService.findAll', async () => {
    lessonsService.findAll.mockResolvedValue([{ lesson_id: 1 } as any]);
    await expect(controller.findAll()).resolves.toEqual([{ lesson_id: 1 }]);
    expect(lessonsService.findAll).toHaveBeenCalledWith();
  });

  it('findOne delegates to LessonsService.findOneAdmin', async () => {
    lessonsService.findOneAdmin.mockResolvedValue({ lesson_id: 123 } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ lesson_id: 123 });
    expect(lessonsService.findOneAdmin).toHaveBeenCalledWith(123);
  });

  it('update delegates to LessonsService.update', async () => {
    lessonsService.update.mockResolvedValue({
      lesson_id: 123,
      lesson_title: 'N',
    } as any);
    await expect(
      controller.update(123, { lesson_title: 'N' } as any),
    ).resolves.toEqual({
      lesson_id: 123,
      lesson_title: 'N',
    });
    expect(lessonsService.update).toHaveBeenCalledWith(123, {
      lesson_title: 'N',
    });
  });

  it('remove delegates to LessonsService.remove', async () => {
    lessonsService.remove.mockResolvedValue({ message: 'ok' });
    await expect(controller.remove(9)).resolves.toEqual({ message: 'ok' });
    expect(lessonsService.remove).toHaveBeenCalledWith(9);
  });

  it('reorder delegates to LessonsService.reorder', async () => {
    lessonsService.reorder.mockResolvedValue([{ lesson_id: 2 } as any]);
    await expect(
      controller.reorder({ chapterId: 10, lessonIds: [2, 1] } as any),
    ).resolves.toEqual([{ lesson_id: 2 }]);
    expect(lessonsService.reorder).toHaveBeenCalledWith(10, [2, 1]);
  });

  it('propagates errors from service', async () => {
    lessonsService.findOneAdmin.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
