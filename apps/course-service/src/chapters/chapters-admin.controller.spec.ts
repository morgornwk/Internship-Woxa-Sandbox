import { Test, TestingModule } from '@nestjs/testing';

import { ChaptersAdminController } from './chapters-admin.controller';
import { ChaptersService } from './chapters.service';

describe('ChaptersAdminController', () => {
  let controller: ChaptersAdminController;
  let chaptersService: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChaptersAdminController],
      providers: [
        {
          provide: ChaptersService,
          useValue: {
            create: jest.fn(),
            findByLevel: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            reorder: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ChaptersAdminController);
    chaptersService = module.get(ChaptersService);
    jest.clearAllMocks();
  });

  it('create delegates to ChaptersService.create', async () => {
    chaptersService.create.mockResolvedValue({ chapter_id: 1 } as any);
    await expect(
      controller.create({ chapter_title: 'T' } as any),
    ).resolves.toEqual({
      chapter_id: 1,
    });
    expect(chaptersService.create).toHaveBeenCalledWith({ chapter_title: 'T' });
  });

  it('findByLevel delegates to ChaptersService.findByLevel', async () => {
    chaptersService.findByLevel.mockResolvedValue([{ chapter_id: 1 } as any]);
    await expect(controller.findByLevel(10)).resolves.toEqual([
      { chapter_id: 1 },
    ]);
    expect(chaptersService.findByLevel).toHaveBeenCalledWith(10);
  });

  it('findAll delegates to ChaptersService.findAll', async () => {
    chaptersService.findAll.mockResolvedValue([{ chapter_id: 1 } as any]);
    await expect(controller.findAll()).resolves.toEqual([{ chapter_id: 1 }]);
    expect(chaptersService.findAll).toHaveBeenCalledWith();
  });

  it('findOne delegates to ChaptersService.findOne', async () => {
    chaptersService.findOne.mockResolvedValue({ chapter_id: 123 } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ chapter_id: 123 });
    expect(chaptersService.findOne).toHaveBeenCalledWith(123);
  });

  it('update delegates to ChaptersService.update', async () => {
    chaptersService.update.mockResolvedValue({
      chapter_id: 123,
      chapter_title: 'N',
    } as any);
    await expect(
      controller.update(123, { chapter_title: 'N' } as any),
    ).resolves.toEqual({
      chapter_id: 123,
      chapter_title: 'N',
    });
    expect(chaptersService.update).toHaveBeenCalledWith(123, {
      chapter_title: 'N',
    });
  });

  it('remove delegates to ChaptersService.remove', async () => {
    chaptersService.remove.mockResolvedValue({ message: 'ok' });
    await expect(controller.remove(9)).resolves.toEqual({ message: 'ok' });
    expect(chaptersService.remove).toHaveBeenCalledWith(9);
  });

  it('reorder delegates to ChaptersService.reorder', async () => {
    chaptersService.reorder.mockResolvedValue([{ chapter_id: 2 } as any]);
    await expect(
      controller.reorder({ level_id: 10, chapter_ids: [2, 1] } as any),
    ).resolves.toEqual([{ chapter_id: 2 }]);
    expect(chaptersService.reorder).toHaveBeenCalledWith(10, [2, 1]);
  });

  it('propagates errors from service', async () => {
    chaptersService.findOne.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
