import { Test, TestingModule } from '@nestjs/testing';

import { ArticlesAdminController } from './articles-admin.controller';
import { ArticlesService } from './articles.service';

describe('ArticlesAdminController', () => {
  let controller: ArticlesAdminController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesAdminController],
      providers: [
        {
          provide: ArticlesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByLesson: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ArticlesAdminController);
    svc = module.get(ArticlesService);
    jest.clearAllMocks();
  });

  it('create delegates to ArticlesService.create', async () => {
    svc.create.mockResolvedValue({ article_id: 1 } as any);
    await expect(controller.create({ lesson_id: 1 } as any)).resolves.toEqual({
      article_id: 1,
    });
    expect(svc.create).toHaveBeenCalledWith({ lesson_id: 1 });
  });

  it('findAll delegates to ArticlesService.findAll', async () => {
    svc.findAll.mockResolvedValue([{ article_id: 1 } as any]);
    await expect(controller.findAll()).resolves.toEqual([{ article_id: 1 }]);
    expect(svc.findAll).toHaveBeenCalledWith();
  });

  it('findOne delegates to ArticlesService.findOne', async () => {
    svc.findOne.mockResolvedValue({ article_id: 123 } as any);
    await expect(controller.findOne(123)).resolves.toEqual({ article_id: 123 });
    expect(svc.findOne).toHaveBeenCalledWith(123);
  });

  it('findByLesson delegates to ArticlesService.findByLesson', async () => {
    svc.findByLesson.mockResolvedValue([{ article_id: 1 } as any]);
    await expect(controller.findByLesson(10)).resolves.toEqual([
      { article_id: 1 },
    ]);
    expect(svc.findByLesson).toHaveBeenCalledWith(10);
  });

  it('update delegates to ArticlesService.update', async () => {
    svc.update.mockResolvedValue({ article_id: 1, article_content: [] } as any);
    await expect(
      controller.update(1, { article_content: [] } as any),
    ).resolves.toEqual({
      article_id: 1,
      article_content: [],
    });
    expect(svc.update).toHaveBeenCalledWith(1, { article_content: [] });
  });

  it('remove delegates to ArticlesService.remove', async () => {
    svc.remove.mockResolvedValue({ message: 'ok' });
    await expect(controller.remove(1)).resolves.toEqual({ message: 'ok' });
    expect(svc.remove).toHaveBeenCalledWith(1);
  });

  it('propagates errors from service', async () => {
    svc.findOne.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
