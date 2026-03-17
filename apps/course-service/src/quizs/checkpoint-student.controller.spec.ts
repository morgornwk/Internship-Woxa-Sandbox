import { Test, TestingModule } from '@nestjs/testing';

import { CheckpointStudentController } from './checkpoint-student.controller';
import { QuizService } from './quiz.service';

describe('CheckpointStudentController', () => {
  let controller: CheckpointStudentController;

  const quizService = {
    findOneCheckpointByLessonId: jest.fn(),
    findCheckpointsByLesson: jest.fn(),
    checkCheckpointAnswer: jest.fn(),
    skipCheckpoint: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckpointStudentController],
      providers: [{ provide: QuizService, useValue: quizService }],
    }).compile();

    controller = module.get(CheckpointStudentController);
    jest.clearAllMocks();
  });

  it('findCheckpointByLessonId delegates and maps score', async () => {
    quizService.findOneCheckpointByLessonId.mockResolvedValue({
      checkpointId: 1,
      checkpointScore: 5,
    });

    await expect(controller.findCheckpointByLessonId(10)).resolves.toEqual({
      checkpointId: 1,
      checkpointScore: 5,
      score: 5,
    });
    expect(quizService.findOneCheckpointByLessonId).toHaveBeenCalledWith(10);
  });

  it('findCheckpointsByLesson delegates', async () => {
    quizService.findCheckpointsByLesson.mockResolvedValue([
      { checkpoint_id: 1 },
    ]);

    await expect(controller.findCheckpointsByLesson(10, 'u1')).resolves.toEqual(
      [{ checkpoint_id: 1 }],
    );
    expect(quizService.findCheckpointsByLesson).toHaveBeenCalledWith(10, 'u1');
  });

  it('checkCheckpoint delegates', async () => {
    quizService.checkCheckpointAnswer.mockResolvedValue({ is_correct: true });

    await expect(controller.checkCheckpoint(1, 'u1', 'a')).resolves.toEqual({
      is_correct: true,
    });
    expect(quizService.checkCheckpointAnswer).toHaveBeenCalledWith(
      1,
      'u1',
      'a',
    );
  });

  it('skipCheckpoint delegates', async () => {
    quizService.skipCheckpoint.mockResolvedValue({
      checkpoint_status: 'SKIPPED',
    });

    await expect(controller.skipCheckpoint(1, 'u1')).resolves.toEqual({
      checkpoint_status: 'SKIPPED',
    });
    expect(quizService.skipCheckpoint).toHaveBeenCalledWith(1, 'u1');
  });
});
