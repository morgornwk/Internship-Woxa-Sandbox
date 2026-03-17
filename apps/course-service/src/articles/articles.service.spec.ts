import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ArticlesService } from './articles.service';
import { Article } from './entities/article.entity';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;

  type ArticleRepoMock = {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };

  type LessonRepoMock = {
    findOne: jest.Mock;
  };

  let articleRepo: ArticleRepoMock;
  let lessonRepo: LessonRepoMock;

  const makeArticle = (overrides: Partial<Article> = {}): Article =>
    ({
      article_id: 1,
      article_content: [],
      lesson: { lesson_id: 10 } as any,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as Article;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: getRepositoryToken(Article),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ArticlesService);
    articleRepo = module.get(getRepositoryToken(Article));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws when lesson not found', async () => {
      lessonRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ lesson_id: 1, article_content: [] } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when lesson is not ARTICLE', async () => {
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 1,
        lesson_type: LessonType.QUIZ,
      } as any);
      await expect(
        service.create({ lesson_id: 1, article_content: [] } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('assigns default order to blocks when missing and saves', async () => {
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 1,
        lesson_type: LessonType.ARTICLE,
      } as any);

      const dto: any = {
        lesson_id: 1,
        article_content: [
          { type: 'p', text: 'x' },
          { type: 'p', text: 'y', order: 99 },
        ],
      };

      const created = makeArticle({
        article_content: dto.article_content,
        lesson: { lesson_id: 1 } as any,
      });
      articleRepo.create.mockReturnValue(created);
      articleRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(created.article_content[0].order).toBe(1);
      expect(created.article_content[1].order).toBe(99);
      expect(result.lesson_id).toBe(1);
    });

    it('treats non-array article_content as empty array', async () => {
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 1,
        lesson_type: LessonType.ARTICLE,
      } as any);

      const created = makeArticle({
        article_content: [] as any,
        lesson: { lesson_id: 1 } as any,
      });
      articleRepo.create.mockReturnValue(created);
      articleRepo.save.mockResolvedValue(created);

      const result = await service.create({
        lesson_id: 1,
        article_content: null,
      } as any);

      expect(articleRepo.create).toHaveBeenCalledWith({
        lesson: { lesson_id: 1 },
        article_content: [],
      });
      expect(result.article_content).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('throws when not found', async () => {
      articleRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns dto', async () => {
      articleRepo.findOne.mockResolvedValue(makeArticle({ article_id: 1 }));
      const result = await service.findOne(1);
      expect(result.article_id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('applies pagination defaults', async () => {
      articleRepo.find.mockResolvedValue([makeArticle({ article_id: 1 })]);
      const result = await service.findAll({ limit: -1, offset: -1 });
      expect(result).toHaveLength(1);
      expect(articleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
          order: { updatedAt: 'DESC' },
        }),
      );
    });

    it('clamps limit to max 100 and uses default params when omitted', async () => {
      articleRepo.find.mockResolvedValue([makeArticle({ article_id: 1 })]);

      await service.findAll({ limit: 9999, offset: 5 });
      expect(articleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 5,
          order: { updatedAt: 'DESC' },
        }),
      );

      jest.clearAllMocks();
      articleRepo.find.mockResolvedValue([]);
      await service.findAll();
      expect(articleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
          order: { updatedAt: 'DESC' },
        }),
      );
    });
  });

  describe('update', () => {
    it('throws when not found', async () => {
      articleRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(1, { article_content: [] } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assigns fields and saves', async () => {
      const article = makeArticle({ article_id: 1, article_content: [] });
      articleRepo.findOne.mockResolvedValue(article);
      articleRepo.save.mockImplementation(async (a) => a);

      const result = await service.update(1, {
        article_content: [{ type: 'p', text: 'x' }],
      } as any);

      expect(result.article_content).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('throws when not found', async () => {
      articleRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes and returns message', async () => {
      const article = makeArticle({ article_id: 1 });
      articleRepo.findOne.mockResolvedValue(article);
      articleRepo.remove.mockResolvedValue(article);

      const result = await service.remove(1);
      expect(articleRepo.remove).toHaveBeenCalledWith(article);
      expect(result.message).toBe('article deleted successfully');
    });
  });

  describe('findByLesson', () => {
    it('throws when lesson not found', async () => {
      lessonRepo.findOne.mockResolvedValue(null);
      await expect(service.findByLesson(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns [] when lesson is not ARTICLE', async () => {
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 1,
        lesson_type: LessonType.QUIZ,
      } as any);
      const result = await service.findByLesson(1);
      expect(result).toEqual([]);
    });

    it('returns mapped list when ARTICLE', async () => {
      lessonRepo.findOne.mockResolvedValue({
        lesson_id: 1,
        lesson_type: LessonType.ARTICLE,
      } as any);
      articleRepo.find.mockResolvedValue([
        makeArticle({ article_id: 1, lesson: { lesson_id: 1 } as any }),
      ]);

      const result = await service.findByLesson(1);
      expect(result).toHaveLength(1);
      expect(result[0].lesson_id).toBe(1);
    });
  });

  describe('toResponseDto', () => {
    it('prefers direct lesson_id field when present', async () => {
      const article: any = makeArticle({
        article_id: 1,
        lesson: { lesson_id: 10 } as any,
      });
      article.lesson_id = 99;

      articleRepo.findOne.mockResolvedValue(article);

      const result = await service.findOne(1);
      expect(result.lesson_id).toBe(99);
    });
  });
});
