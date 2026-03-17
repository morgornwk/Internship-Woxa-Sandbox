import { Test, TestingModule } from '@nestjs/testing';

import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

describe('ProgressController', () => {
  let controller: ProgressController;

  const progressService = {
    getAllLessonProgress: jest.fn(),
    getLessonProgress: jest.fn(),
    upsertLessonProgress: jest.fn(),
    skipLessonAndUnlockNext: jest.fn(),
    getChapterProgress: jest.fn(),
    getChapterRoadmap: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [{ provide: ProgressService, useValue: progressService }],
    }).compile();

    controller = module.get(ProgressController);
    jest.clearAllMocks();
  });

  it('getAllLessonProgress delegates', async () => {
    progressService.getAllLessonProgress.mockResolvedValue([{ lessonId: 1 }]);

    await expect(controller.getAllLessonProgress('u1')).resolves.toEqual([
      { lessonId: 1 },
    ]);
    expect(progressService.getAllLessonProgress).toHaveBeenCalledWith('u1');
  });

  it('getLessonProgress delegates', async () => {
    progressService.getLessonProgress.mockResolvedValue({ lessonId: 10 });

    await expect(controller.getLessonProgress('u1', 10)).resolves.toEqual({
      lessonId: 10,
    });
    expect(progressService.getLessonProgress).toHaveBeenCalledWith('u1', 10);
  });

  it('upsertLessonProgress delegates', async () => {
    progressService.upsertLessonProgress.mockResolvedValue({
      lessonId: 10,
      status: 'IN_PROGRESS',
    });

    const dto: any = { progressPercent: 50 };
    await expect(
      controller.upsertLessonProgress('u1', 10, dto),
    ).resolves.toEqual({
      lessonId: 10,
      status: 'IN_PROGRESS',
    });
    expect(progressService.upsertLessonProgress).toHaveBeenCalledWith(
      'u1',
      10,
      dto,
    );
  });

  it('skipLesson delegates', async () => {
    progressService.skipLessonAndUnlockNext.mockResolvedValue({
      skipped: { lessonId: 10 },
      unlockedNext: null,
    });

    await expect(controller.skipLesson('u1', 10)).resolves.toEqual({
      skipped: { lessonId: 10 },
      unlockedNext: null,
    });
    expect(progressService.skipLessonAndUnlockNext).toHaveBeenCalledWith(
      'u1',
      10,
    );
  });

  it('getChapterProgress delegates', async () => {
    progressService.getChapterProgress.mockResolvedValue({
      chapterId: 1,
      percent: 0,
    });

    await expect(controller.getChapterProgress('u1', 1)).resolves.toEqual({
      chapterId: 1,
      percent: 0,
    });
    expect(progressService.getChapterProgress).toHaveBeenCalledWith('u1', 1);
  });

  it('getChapterRoadmap delegates', async () => {
    progressService.getChapterRoadmap.mockResolvedValue({
      chapterId: 1,
      items: [],
    });

    await expect(controller.getChapterRoadmap('u1', 1)).resolves.toEqual({
      chapterId: 1,
      items: [],
    });
    expect(progressService.getChapterRoadmap).toHaveBeenCalledWith('u1', 1);
  });

  it('propagates errors', async () => {
    progressService.getLessonProgress.mockRejectedValue(new Error('boom'));

    await expect(controller.getLessonProgress('u1', 10)).rejects.toThrow(
      'boom',
    );
  });
});
