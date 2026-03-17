import { Test, TestingModule } from '@nestjs/testing';

import { LevelsAdminController } from './levels-admin.controller';
import { LevelsService } from './levels.service';

describe('LevelsAdminController', () => {
  let controller: LevelsAdminController;
  let levelsService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LevelsAdminController],
      providers: [
        {
          provide: LevelsService,
          useValue: {
            create: jest.fn(),
            findByCourse: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            reorder: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LevelsAdminController);
    levelsService = module.get(LevelsService);
    jest.clearAllMocks();
  });

  it('create delegates to LevelsService.create', async () => {
    levelsService.create.mockResolvedValue({ level_id: 1 } as any);
    await expect(
      controller.create({ level_title: 'L1' } as any),
    ).resolves.toEqual({ level_id: 1 });
    expect(levelsService.create).toHaveBeenCalledWith({ level_title: 'L1' });
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

  it('update delegates to LevelsService.update', async () => {
    levelsService.update.mockResolvedValue({
      level_id: 123,
      level_title: 'N',
    } as any);
    await expect(
      controller.update(123, { level_title: 'N' } as any),
    ).resolves.toEqual({
      level_id: 123,
      level_title: 'N',
    });
    expect(levelsService.update).toHaveBeenCalledWith(123, {
      level_title: 'N',
    });
  });

  it('remove delegates to LevelsService.remove', async () => {
    levelsService.remove.mockResolvedValue({ message: 'ok' });
    await expect(controller.remove(9)).resolves.toEqual({ message: 'ok' });
    expect(levelsService.remove).toHaveBeenCalledWith(9);
  });

  it('reorder delegates to LevelsService.reorder', async () => {
    levelsService.reorder.mockResolvedValue([{ level_id: 2 } as any]);
    await expect(
      controller.reorder({ course_id: 10, level_ids: [2, 1] } as any),
    ).resolves.toEqual([{ level_id: 2 }]);
    expect(levelsService.reorder).toHaveBeenCalledWith(10, [2, 1]);
  });

  it('propagates errors from service', async () => {
    levelsService.findOne.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
