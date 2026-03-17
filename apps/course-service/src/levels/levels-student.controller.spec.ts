import { Test, TestingModule } from '@nestjs/testing';

import { LevelsStudentController } from './levels-student.controller';
import { LevelsService } from './levels.service';

describe('LevelsStudentController', () => {
  let controller: LevelsStudentController;
  let levelsService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LevelsStudentController],
      providers: [
        {
          provide: LevelsService,
          useValue: {
            findByCourse: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LevelsStudentController);
    levelsService = module.get(LevelsService);
    jest.clearAllMocks();
  });

  it('findByCourse delegates to LevelsService.findByCourse', async () => {
    levelsService.findByCourse.mockResolvedValue([{ level_id: 1 } as any]);
    await expect(controller.findByCourse(10)).resolves.toEqual([
      { level_id: 1 },
    ]);
    expect(levelsService.findByCourse).toHaveBeenCalledWith(10);
  });

  it('findAll delegates to LevelsService.findAll', async () => {
    levelsService.findAll.mockResolvedValue([{ level_id: 1 } as any]);
    await expect(controller.findAll()).resolves.toEqual([{ level_id: 1 }]);
    expect(levelsService.findAll).toHaveBeenCalledWith();
  });

  it('findOne delegates to LevelsService.findOne', async () => {
    levelsService.findOne.mockResolvedValue({ level_id: 123 } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ level_id: 123 });
    expect(levelsService.findOne).toHaveBeenCalledWith(123);
  });

  it('propagates errors from service', async () => {
    levelsService.findOne.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
