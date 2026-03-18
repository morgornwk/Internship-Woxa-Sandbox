import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';

import { AiQuizService } from './ai-quiz.service';
import { AiQuizGeneration } from './entities/ai-analyzer-entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Quizs } from '../quizs/entities/quizs.entity';
import { Article } from '../articles/entities/article.entity';

jest.mock('axios', () => {
  const post = jest.fn();
  const isAxiosError = (err: any) => err?.isAxiosError === true;

  return {
    __esModule: true,
    default: { post, isAxiosError },
  };
});

describe('AiQuizService', () => {
  let service: AiQuizService;
  let aiRepo: jest.Mocked<Partial<Repository<AiQuizGeneration>>>;
  let lessonRepo: jest.Mocked<Partial<Repository<Lesson>>>;
  let quizRepo: jest.Mocked<Partial<Repository<Quizs>>>;
  let articleRepo: jest.Mocked<Partial<Repository<Article>>>;
  let axiosPostMock: jest.Mock;

  const envBackup = { ...process.env };

  beforeEach(async () => {
    process.env = { ...envBackup };

    axiosPostMock = (axios as any).post as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQuizService,
        {
          provide: getRepositoryToken(AiQuizGeneration),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Quizs),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Article),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
      ],
    }).compile();

    service = module.get(AiQuizService);
    aiRepo = module.get(getRepositoryToken(AiQuizGeneration));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    quizRepo = module.get(getRepositoryToken(Quizs));
    articleRepo = module.get(getRepositoryToken(Article));

    jest.clearAllMocks();
    axiosPostMock.mockReset();
  });

  afterAll(() => {
    process.env = envBackup;
  });

  describe('generateQuizFromLesson', () => {
    it('throws when lesson not found', async () => {
      (lessonRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.generateQuizFromLesson(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when lesson content empty (no description and no title)', async () => {
      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_title: '   ',
        lesson_description: '   ',
      } as any);
      await expect(service.generateQuizFromLesson(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('parses article_content with article field correctly', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'fallback',
      } as any);

      const mockArticle = {
        article_id: 10,
        article_content: [
          {
            imageUrl: 'https://example.com/img1.jpg',
            article: 'First paragraph content',
            order: 1,
          },
          {
            imageUrl: 'https://example.com/img2.jpg',
            article: 'Second paragraph content',
            order: 2,
          },
          {
            article: 'Third paragraph without image',
            order: 3,
          },
        ],
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockArticle),
        getMany: jest.fn().mockResolvedValue([mockArticle]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      expect(axiosPostMock).toHaveBeenCalled();
      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('First paragraph content');
      expect(prompt).toContain('Second paragraph content');
      expect(prompt).toContain('Third paragraph without image');
      expect(prompt).not.toContain('fallback');
    });

    it('filters out empty article blocks', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'fallback',
      } as any);

      const mockArticle = {
        article_id: 10,
        article_content: [
          { article: 'Valid content', order: 1 },
          { article: '', order: 2 },
          { article: '   ', order: 3 },
          { article: 'Another valid content', order: 4 },
        ],
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockArticle),
        getMany: jest.fn().mockResolvedValue([mockArticle]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('Valid content');
      expect(prompt).toContain('Another valid content');
      expect(prompt).not.toContain('fallback');
    });

    it('handles article_content with string blocks', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'fallback',
      } as any);

      const mockArticle = {
        article_id: 10,
        article_content: [
          'String content 1',
          'String content 2',
          { article: 'Object content', order: 1 },
        ],
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockArticle),
        getMany: jest.fn().mockResolvedValue([mockArticle]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('String content 1');
      expect(prompt).toContain('String content 2');
      expect(prompt).toContain('Object content');
    });

    it('falls back to lesson_description when article not found', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'Lesson description content',
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('Lesson description content');
    });

    it('falls back to lesson_title when article and description empty', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_title: 'Lesson Title',
        lesson_description: '',
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('Lesson Title');
    });

    it('falls back to lesson_description when article_content is all empty', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';

      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'Fallback description',
      } as any);

      const mockArticle = {
        article_id: 10,
        article_content: [
          { article: '', order: 1 },
          { article: '   ', order: 2 },
        ],
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockArticle),
        getMany: jest.fn().mockResolvedValue([mockArticle]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await service.generateQuizFromLesson(1);

      const callArgs = axiosPostMock.mock.calls[0];
      const prompt = callArgs[1].messages[1].content;

      expect(prompt).toContain('Fallback description');
    });

    it('throws ServiceUnavailableException when HUGGINGFACE_API_KEY missing', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'content',
      } as any);

      await expect(service.generateQuizFromLesson(1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('saves PENDING generation when AI returns valid JSON', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';
      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'content',
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'multiple_choice',
                      question: 'q',
                      choices: ['a', 'b', 'c', 'd'],
                      answerIndex: 1,
                      explanation: 'e',
                    },
                  ],
                }),
              },
            },
          ],
        },
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      const res = await service.generateQuizFromLesson(1, {
        language: 'TH',
        difficulty: 'easy',
      } as any);

      expect(res.status).toBe('PENDING');
      expect(res.lessonId).toBe(1);
      expect(res.ai_response?.questions?.[0]?.question).toBe('q');
    });

    it('persists REJECTED and maps quota errors to HttpException(429)', async () => {
      process.env.HUGGINGFACE_API_KEY = 'k';
      process.env.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';
      (lessonRepo.findOne as jest.Mock).mockResolvedValue({
        lesson_id: 1,
        lesson_description: 'content',
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      };

      (articleRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      axiosPostMock.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: { error: { message: 'quota' } },
        },
        message: 'quota',
      });

      (aiRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      await expect(service.generateQuizFromLesson(1)).rejects.toBeInstanceOf(
        HttpException,
      );

      const savedCalls = (aiRepo.save as jest.Mock).mock.calls;
      const lastSaved = savedCalls[savedCalls.length - 1][0];
      expect(lastSaved.status).toBe('REJECTED');
    });
  });

  describe('approveAiQuiz', () => {
    it('throws when AI quiz not found', async () => {
      (aiRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.approveAiQuiz(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when already approved', async () => {
      (aiRepo.findOne as jest.Mock).mockResolvedValue({
        ai_quiz_id: 1,
        status: 'APPROVED',
      } as any);
      await expect(service.approveAiQuiz(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates quiz when none exists and marks APPROVED', async () => {
      (aiRepo.findOne as jest.Mock).mockResolvedValue({
        ai_quiz_id: 1,
        lessonId: 10,
        status: 'PENDING',
        ai_response: {
          questions: [
            {
              question: 'q',
              choices: ['a', 'b', 'c', 'd'],
              answerIndex: 2,
              explanation: 'e',
            },
          ],
        },
      } as any);
      (quizRepo.findOne as jest.Mock).mockResolvedValue(null);
      (quizRepo.create as jest.Mock).mockImplementation((x: any) => x);
      (quizRepo.save as jest.Mock).mockImplementation(async (x) => ({
        ...x,
        quizsId: 99,
      }));
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      const quiz = await service.approveAiQuiz(1);

      expect(quizRepo.create).toHaveBeenCalled();
      expect(quiz.quizsId).toBe(99);
      expect(aiRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED' }),
      );
    });

    it('updates existing quiz when exists', async () => {
      (aiRepo.findOne as jest.Mock).mockResolvedValue({
        ai_quiz_id: 1,
        lessonId: 10,
        status: 'PENDING',
        ai_response: {
          questions: [
            {
              question: 'q',
              choices: ['a', 'b', 'c', 'd'],
              answerIndex: 0,
              explanation: 'e',
            },
          ],
        },
      } as any);

      const existing = { quizsId: 1, lessonId: 10 } as any;
      (quizRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (quizRepo.save as jest.Mock).mockImplementation(async (x) => x);
      (aiRepo.save as jest.Mock).mockImplementation(async (x) => x);

      const quiz = await service.approveAiQuiz(1);

      expect(quizRepo.create).not.toHaveBeenCalled();
      expect(quiz.lessonId).toBe(10);
      expect(aiRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED' }),
      );
    });
  });
});
