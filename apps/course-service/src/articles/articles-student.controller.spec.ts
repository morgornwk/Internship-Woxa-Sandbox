import { Test, TestingModule } from '@nestjs/testing';

import { ArticlesStudentController } from './articles-student.controller';
import { ArticlesService } from './articles.service';

describe('ArticlesStudentController', () => {
  let controller: ArticlesStudentController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesStudentController],
      providers: [
        {
          provide: ArticlesService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByLesson: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ArticlesStudentController);
    svc = module.get(ArticlesService);
    jest.clearAllMocks();
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

  it('propagates errors from service', async () => {
    svc.findOne.mockRejectedValue(new Error('boom'));
    await expect(controller.findOne(1)).rejects.toThrow('boom');
  });
});
