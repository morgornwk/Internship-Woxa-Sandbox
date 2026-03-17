import { Test, TestingModule } from '@nestjs/testing';

import { LessonsStudentController } from './lessons-student.controller';
import { LessonsService } from './lessons.service';

describe('LessonsStudentController', () => {
  let controller: LessonsStudentController;
  let lessonsService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonsStudentController],
      providers: [
        {
          provide: LessonsService,
          useValue: {
            findPublishedByChapter: jest.fn(),
            findAllPublished: jest.fn(),
            findOnePublished: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LessonsStudentController);
    lessonsService = module.get(LessonsService);
    jest.clearAllMocks();
  });

  it('findByChapter delegates to LessonsService.findPublishedByChapter', async () => {
    lessonsService.findPublishedByChapter.mockResolvedValue([
      { lesson_id: 1 } as any,
    ]);
    await expect(controller.findByChapter(10)).resolves.toEqual([
      { lesson_id: 1 },
    ]);
    expect(lessonsService.findPublishedByChapter).toHaveBeenCalledWith(10);
  });

  it('findAll delegates to LessonsService.findAllPublished', async () => {
    lessonsService.findAllPublished.mockResolvedValue([
      { lesson_id: 1 } as any,
    ]);
    await expect(controller.findAll()).resolves.toEqual([{ lesson_id: 1 }]);
    expect(lessonsService.findAllPublished).toHaveBeenCalledWith();
  });

  it('findOne delegates to LessonsService.findOnePublished', async () => {
    lessonsService.findOnePublished.mockResolvedValue({
      lesson_id: 123,
    } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ lesson_id: 123 });
    expect(lessonsService.findOnePublished).toHaveBeenCalledWith(123);
  });

  it('propagates errors from service', async () => {
    lessonsService.findOnePublished.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
