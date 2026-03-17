import { Test, TestingModule } from '@nestjs/testing';

import { ChaptersStudentController } from './chapters-student.controller';
import { ChaptersService } from './chapters.service';

describe('ChaptersStudentController', () => {
  let controller: ChaptersStudentController;
  let chaptersService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChaptersStudentController],
      providers: [
        {
          provide: ChaptersService,
          useValue: {
            findByLevelStudent: jest.fn(),
            findAllStudent: jest.fn(),
            findOneStudent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ChaptersStudentController);
    chaptersService = module.get(ChaptersService);
    jest.clearAllMocks();
  });

  it('findByLevel delegates to ChaptersService.findByLevelStudent', async () => {
    chaptersService.findByLevelStudent.mockResolvedValue([
      { chapter_id: 1 } as any,
    ]);
    await expect(controller.findByLevel(10)).resolves.toEqual([
      { chapter_id: 1 },
    ]);
    expect(chaptersService.findByLevelStudent).toHaveBeenCalledWith(10);
  });

  it('findAll delegates to ChaptersService.findAllStudent', async () => {
    chaptersService.findAllStudent.mockResolvedValue([
      { chapter_id: 1 } as any,
    ]);
    await expect(controller.findAll()).resolves.toEqual([{ chapter_id: 1 }]);
    expect(chaptersService.findAllStudent).toHaveBeenCalledWith();
  });

  it('findOne delegates to ChaptersService.findOneStudent', async () => {
    chaptersService.findOneStudent.mockResolvedValue({
      chapter_id: 123,
    } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ chapter_id: 123 });
    expect(chaptersService.findOneStudent).toHaveBeenCalledWith(123);
  });

  it('propagates errors from service', async () => {
    chaptersService.findOneStudent.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
