import { Test, TestingModule } from '@nestjs/testing';

import { QuizAdminController } from './quiz-admin.controller';
import { QuizService } from './quiz.service';

describe('QuizAdminController', () => {
  let controller: QuizAdminController;

  const quizService = {
    createQuizs: jest.fn(),
    checkAndSaveAnswer: jest.fn(),
    skipQuiz: jest.fn(),
    findAllQuizs: jest.fn(),
    findOneQuizsByLesson: jest.fn(),
    getQuizWithStatus: jest.fn(),
    updateQuizs: jest.fn(),
    removeQuizs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizAdminController],
      providers: [{ provide: QuizService, useValue: quizService }],
    }).compile();

    controller = module.get(QuizAdminController);
    jest.clearAllMocks();
  });

  it('createQuiz delegates', async () => {
    quizService.createQuizs.mockResolvedValue({ quizsId: 1 });
    const dto: any = { lesson_id: 1 };

    await expect(controller.createQuiz(dto)).resolves.toEqual({ quizsId: 1 });
    expect(quizService.createQuizs).toHaveBeenCalledWith(dto);
  });

  it('checkQuizs delegates', async () => {
    quizService.checkAndSaveAnswer.mockResolvedValue({ is_correct: true });

    await expect(controller.checkQuizs(10, 'u1', 'a')).resolves.toEqual({
      is_correct: true,
    });
    expect(quizService.checkAndSaveAnswer).toHaveBeenCalledWith(10, 'u1', 'a');
  });

  it('skipQuiz delegates', async () => {
    quizService.skipQuiz.mockResolvedValue({ status: 'SKIPPED' });

    await expect(controller.skipQuiz(10, 'u1')).resolves.toEqual({
      status: 'SKIPPED',
    });
    expect(quizService.skipQuiz).toHaveBeenCalledWith(10, 'u1');
  });

  it('findAllQuizzes delegates', async () => {
    quizService.findAllQuizs.mockResolvedValue([{ quiz_id: 1 }]);

    await expect(controller.findAllQuizzes()).resolves.toEqual([
      { quiz_id: 1 },
    ]);
    expect(quizService.findAllQuizs).toHaveBeenCalled();
  });

  it('findQuizByLessonAdmin delegates', async () => {
    quizService.findOneQuizsByLesson.mockResolvedValue({ lessonId: 10 });

    await expect(controller.findQuizByLessonAdmin(10)).resolves.toEqual({
      lessonId: 10,
    });
    expect(quizService.findOneQuizsByLesson).toHaveBeenCalledWith(10);
  });

  it('findOneQuizByLesson delegates', async () => {
    quizService.getQuizWithStatus.mockResolvedValue({
      lesson_id: 10,
      status: 'NOT_ATTEMPTED',
    });

    await expect(controller.findOneQuizByLesson(10, 'u1')).resolves.toEqual({
      lesson_id: 10,
      status: 'NOT_ATTEMPTED',
    });
    expect(quizService.getQuizWithStatus).toHaveBeenCalledWith(10, 'u1');
  });

  it('updateQuiz delegates', async () => {
    quizService.updateQuizs.mockResolvedValue({
      lessonId: 10,
      quizsQuestions: 'q',
    });
    const dto: any = { quizs_questions: 'q' };

    await expect(controller.updateQuiz(10, dto)).resolves.toEqual({
      lessonId: 10,
      quizsQuestions: 'q',
    });
    expect(quizService.updateQuizs).toHaveBeenCalledWith(10, dto);
  });

  it('removeQuiz delegates', async () => {
    quizService.removeQuizs.mockResolvedValue({ message: 'ok' });

    await expect(controller.removeQuiz(10)).resolves.toEqual({ message: 'ok' });
    expect(quizService.removeQuizs).toHaveBeenCalledWith(10);
  });

  it('propagates errors', async () => {
    quizService.findAllQuizs.mockRejectedValue(new Error('boom'));
    await expect(controller.findAllQuizzes()).rejects.toThrow('boom');
  });
});
