import { Test, TestingModule } from '@nestjs/testing';

import { QuizStudentController } from './quiz-student.controller';
import { QuizService } from './quiz.service';

describe('QuizStudentController', () => {
  let controller: QuizStudentController;

  const quizService = {
    findAllQuizs: jest.fn(),
    getQuizWithStatus: jest.fn(),
    checkAndSaveAnswer: jest.fn(),
    skipQuiz: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizStudentController],
      providers: [{ provide: QuizService, useValue: quizService }],
    }).compile();

    controller = module.get(QuizStudentController);
    jest.clearAllMocks();
  });

  it('findAllQuizzes delegates', async () => {
    quizService.findAllQuizs.mockResolvedValue([{ quiz_id: 1 }]);

    await expect(controller.findAllQuizzes()).resolves.toEqual([{ quiz_id: 1 }]);
    expect(quizService.findAllQuizs).toHaveBeenCalled();
  });

  it('findOneQuizByLesson delegates', async () => {
    quizService.getQuizWithStatus.mockResolvedValue({ lesson_id: 10, status: 'NOT_ATTEMPTED' });

    await expect(controller.findOneQuizByLesson(10, 'u1')).resolves.toEqual({ lesson_id: 10, status: 'NOT_ATTEMPTED' });
    expect(quizService.getQuizWithStatus).toHaveBeenCalledWith(10, 'u1');
  });

  it('checkQuizs delegates', async () => {
    quizService.checkAndSaveAnswer.mockResolvedValue({ is_correct: true });

    await expect(controller.checkQuizs(10, 'u1', 'a')).resolves.toEqual({ is_correct: true });
    expect(quizService.checkAndSaveAnswer).toHaveBeenCalledWith(10, 'u1', 'a');
  });

  it('skipQuiz delegates', async () => {
    quizService.skipQuiz.mockResolvedValue({ status: 'SKIPPED' });

    await expect(controller.skipQuiz(10, 'u1')).resolves.toEqual({ status: 'SKIPPED' });
    expect(quizService.skipQuiz).toHaveBeenCalledWith(10, 'u1');
  });
});
