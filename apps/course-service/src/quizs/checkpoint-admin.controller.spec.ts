import { Test, TestingModule } from '@nestjs/testing';

import { CheckpointAdminController } from './checkpoint-admin.controller';
import { QuizService } from './quiz.service';

describe('CheckpointAdminController', () => {
  let controller: CheckpointAdminController;

  const quizService = {
    createCheckpoint: jest.fn(),
    checkCheckpointAnswer: jest.fn(),
    skipCheckpoint: jest.fn(),
    findOneCheckpointByLessonId: jest.fn(),
    findCheckpointsByLesson: jest.fn(),
    updateCheckpointByLessonId: jest.fn(),
    removeCheckpointByLessonId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckpointAdminController],
      providers: [{ provide: QuizService, useValue: quizService }],
    }).compile();

    controller = module.get(CheckpointAdminController);
    jest.clearAllMocks();
  });

  it('createCheckpoint delegates and maps score', async () => {
    quizService.createCheckpoint.mockResolvedValue({
      checkpointId: 1,
      checkpointScore: 10,
    });
    const dto: any = { lesson_id: 10 };

    await expect(controller.createCheckpoint(dto)).resolves.toEqual({
      checkpointId: 1,
      checkpointScore: 10,
      score: 10,
    });
    expect(quizService.createCheckpoint).toHaveBeenCalledWith(dto);
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

  it('updateCheckpoint delegates and maps score', async () => {
    quizService.updateCheckpointByLessonId.mockResolvedValue({
      checkpointId: 1,
      checkpointScore: 15,
    });
    const dto: any = { checkpoint_questions: 'q' };

    await expect(controller.updateCheckpoint(10, dto)).resolves.toEqual({
      checkpointId: 1,
      checkpointScore: 15,
      score: 15,
    });
    expect(quizService.updateCheckpointByLessonId).toHaveBeenCalledWith(
      10,
      dto,
    );
  });

  it('removeCheckpoint delegates', async () => {
    quizService.removeCheckpointByLessonId.mockResolvedValue({ message: 'ok' });

    await expect(controller.removeCheckpoint(10)).resolves.toEqual({
      message: 'ok',
    });
    expect(quizService.removeCheckpointByLessonId).toHaveBeenCalledWith(10);
  });
});
