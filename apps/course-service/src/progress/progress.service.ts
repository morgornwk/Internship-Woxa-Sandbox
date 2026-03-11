import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';

import { Lesson } from '../lessons/entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { UpsertLessonProgressDto } from './dto/upsert-lesson-progress.dto';
import { LessonProgress, LessonProgressStatus } from './entities/progress.entity';
import { LessonProgressResponseDto } from './dto/lesson-progress-response.dto';
import { ChapterProgressDto } from './dto/chapter-progress.dto';
import { ChapterRoadmapDto, ItemStatusDto } from './dto/chapter-roadmap.dto';
import { StreakService } from '../streaks/streak.service';
import { QuizService } from '../quizs/quiz.service';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly lessonProgressRepository: Repository<LessonProgress>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    private readonly streakService: StreakService,
    private readonly quizService: QuizService,
    @Optional()
    private readonly redisCacheService?: RedisCacheService,
  ) { }

  async getAllLessonProgress(
    userId: string,
  ): Promise<LessonProgressResponseDto[]> {
    // เรียกดูแถวทั้งหมดของ lesson_progress สำหรับผู้ใช้ปัจจุบัน
    const rows = await this.lessonProgressRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    // ถ้าไม่มีแถวใดเลย ให้คืนค่า Array ว่าง
    if (rows.length === 0) {
      return [];
    }

    // ดึงบทเรียนที่เกี่ยวข้องกับแถว progress
    const lessonIds = Array.from(new Set(rows.map((r) => r.lessonId)));
    const lessons = await this.lessonRepository.find({
      where: { lesson_id: In(lessonIds) },
    });

    // map บทเรียนตาม ID เพื่อให้เข้าถึงได้ง่ายเมื่อสร้าง DTO สำหรับแต่ละแถว progress
    const lessonById = new Map(lessons.map((l) => [l.lesson_id, l] as const));

    // ดึงบทที่เกี่ยวข้องกับบทเรียนเหล่านั้น
    const chapterIds = Array.from(new Set(lessons.map((l) => l.chapter_id)));
    const chapters = chapterIds.length
      ? await this.chapterRepository.find({
        where: { chapter_id: In(chapterIds) },
      })
      : [];
    const levelIdByChapterId = new Map(
      chapters.map((c) => [c.chapter_id, c.levelId] as const),
    );

    return rows.map((r) => {
      const lesson = lessonById.get(r.lessonId);
      const chapterId = lesson?.chapter_id ?? null;
      const levelId = chapterId != null ? (levelIdByChapterId.get(chapterId) ?? null) : null;
      return this.toResponse(r, { chapterId, levelId });
    });
  }

  // ดึงความคืบหน้าของบทเรียนเดียว
  async getLessonProgress(
    userId: string,
    lessonId: number,
  ): Promise<LessonProgressResponseDto | null> {
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // เรียกดูแถวของ lesson_progress สำหรับบทเรียนและผู้ใช้ที่ระบุ
    const row = await this.lessonProgressRepository.findOne({
      where: { userId, lessonId },
    });

    // ถ้าไม่มีแถว progress ให้คืน Error 404 
    if (!row) {
      throw new NotFoundException(`Progress for lesson ${lessonId} not found`);
    }

    // ดึงบทที่เกี่ยวข้องเพื่อใส่ใน DTO
    const chapterId = lesson?.chapter_id ?? null;
    const chapter = chapterId != null ? await this.chapterRepository.findOne({
      where: { chapter_id: chapterId },
    })
      : null;

    const levelId = chapter?.levelId ?? null;

    return this.toResponse(row, { chapterId, levelId });
  }

  // เพิ่มหรือแก้ไขความคืบหน้าของบทเรียน
  async upsertLessonProgress(
    userId: string,
    lessonId: number,
    dto: UpsertLessonProgressDto,
  ): Promise<LessonProgressResponseDto> {
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // ดึงหรือสร้างแถว progress สำหรับบทเรียนนี้และผู้ใช้ที่ระบุ
    let row = await this.lessonProgressRepository.findOne({
      where: { userId, lessonId },
    });

    // ถ้าไม่มีแถว ให้สร้างใหม่
    if (!row) {
      row = this.lessonProgressRepository.create({
        userId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        progressPercent: 0,
      });
    }

    // ห้ามแก้ไขสถานะของบทเรียนที่ถูกทำเครื่องหมายว่าเสร็จสมบูรณ์แล้ว (COMPLETED) ให้ยกเว้นแต่จะยังคงเป็น COMPLETED เท่านั้น
    if (row && row.status === LessonProgressStatus.COMPLETED) {
      if (dto.status !== undefined && dto.status !== LessonProgressStatus.COMPLETED) {
        throw new BadRequestException('Cannot change status of a completed lesson');
      }
    }

    // เก็บสถานะก่อนหน้าเพื่อใช้ในการตัดสินใจเรื่องการเพิ่ม streak
    const previousStatus = row.status;

    if (dto.positionSeconds !== undefined) {
      row.positionSeconds = dto.positionSeconds;
    }

    if (dto.durationSeconds !== undefined) {
      row.durationSeconds = dto.durationSeconds;
    }

    // คำนวณเปอร์เซ็นต์ความคืบหน้าที่ได้จาก positionSeconds และ durationSeconds ถ้า progressPercent ไม่ได้ถูกระบุมาใน DTO
    const inferredPercent =
      dto.progressPercent === undefined &&
        dto.positionSeconds !== undefined &&
        dto.durationSeconds !== undefined &&
        dto.durationSeconds > 0
        ? (dto.positionSeconds / dto.durationSeconds) * 100
        : undefined;

    // อัปเดตเปอร์เซ็นต์ความคืบหน้า
    const nextPercent = dto.progressPercent ?? inferredPercent;

    // ตรวจสอบให้แน่ใจว่าเปอร์เซ็นต์อยู่ในช่วง 0-100
    if (nextPercent !== undefined && !Number.isNaN(nextPercent)) {
      const clamped = Math.max(0, Math.min(100, Number(nextPercent)));

      // ถ้าบทเรียนถูกทำเครื่องหมายว่าเสร็จสมบูรณ์แล้ว (COMPLETED) ให้บังคับให้เปอร์เซ็นต์เป็น 100 เสมอ
      row.progressPercent = Math.round(clamped);
    }

    if (dto.status !== undefined) {
      row.status = dto.status;
    }

    // อัปเดตเวลาที่ดูล่าสุด
    row.lastViewedAt = new Date();

    // ถ้าเสร็จสมบูรณ์แล้วแต่ยังไม่มีเวลาที่ทำเครื่องหมายว่าเสร็จสมบูรณ์ ให้ตั้งค่า completedAt เป็นเวลาปัจจุบัน
    if (dto.markCompleted) {
      row.status = LessonProgressStatus.COMPLETED;
      row.progressPercent = 100;
      row.completedAt = new Date();
    }

    // ถ้าสถานะเป็น COMPLETED/SKIPPED ให้ percent=100 และมี completedAt เสมอ
    if (
      row.status === LessonProgressStatus.COMPLETED ||
      row.status === LessonProgressStatus.SKIPPED
    ) {
      row.progressPercent = 100;
      row.completedAt = row.completedAt ?? new Date();
    }

    const saved = await this.lessonProgressRepository.save(row);

    // เพิ่ม streak เฉพาะเมื่อเปลี่ยนสถานะเป็น COMPLETED หรือ SKIPPED เป็นครั้งแรก
    const wasCompleted = previousStatus === LessonProgressStatus.COMPLETED || previousStatus === LessonProgressStatus.SKIPPED;
    const nowCompleted = saved.status === LessonProgressStatus.COMPLETED || saved.status === LessonProgressStatus.SKIPPED;
    if (!wasCompleted && nowCompleted) {
      await this.streakService.bumpStreak(userId, saved.completedAt ?? new Date());
    }

    // ตรวจสอบบทเรียนถัดไปในบทเดียวกัน
    const nextLesson = await this.lessonRepository.findOne({
      where: {
        chapter_id: lesson.chapter_id,
        orderIndex: MoreThan(lesson.orderIndex),
        isPublished: true,
      },
      order: { orderIndex: 'ASC' },
    });

    // จัดการบทเรียนถัดไป
    if (nextLesson) {
      let nextProgress = await this.lessonProgressRepository.findOne({
        where: { userId, lessonId: nextLesson.lesson_id },
      });

      // ถ้าไม่มีแถว progress สำหรับบทเรียนถัดไป ให้สร้างเป็น LOCKED
      if (!nextProgress) {
        nextProgress = this.lessonProgressRepository.create({
          userId,
          lessonId: nextLesson.lesson_id,
          status: LessonProgressStatus.LOCKED,
          progressPercent: 0,
          mapLessonId: lessonId,
        });
        await this.lessonProgressRepository.save(nextProgress);
      } else if (nextProgress.mapLessonId == null) {
        nextProgress.mapLessonId = lessonId;
        await this.lessonProgressRepository.save(nextProgress);
      }

      // ถ้าบทเรียนปัจจุบันเสร็จสิ้น ให้ปลดล็อกบทเรียนถัดไป
      if (
        (saved.status === LessonProgressStatus.COMPLETED ||
          saved.status === LessonProgressStatus.SKIPPED) &&
        nextProgress.status === LessonProgressStatus.LOCKED
      ) {
        nextProgress.status = LessonProgressStatus.IN_PROGRESS;
        nextProgress.lastViewedAt = new Date();
        await this.lessonProgressRepository.save(nextProgress);
      }
    }

    // หากไม่มีบทเรียนถัดไปในบทเดียวกัน ให้พยายามปลดล็อกบทถัดไปของ -> บทถัดไป
    if (!nextLesson) {
      const chapterCompleted = await this.isChapterCompletedForUser(userId, lesson.chapter_id);

      // ถ้า chapter นี้ถูกทำเครื่องหมายว่าเสร็จสมบูรณ์แล้ว ให้ปลดล็อกบทเรียนตัวแรกของ chapter ถัดไป
      if (chapterCompleted) {
        const currentChapter = await this.chapterRepository.findOne({ where: { chapter_id: lesson.chapter_id } });
        if (currentChapter) {
          const nextChapter = await this.chapterRepository.findOne({
            where: {
              levelId: currentChapter.levelId,
              chapter_orderIndex: MoreThan(currentChapter.chapter_orderIndex ?? 0),
            },
            order: { chapter_orderIndex: 'ASC' },
          });

          // ถ้ามีบทถัดไปในระดับเดียวกัน ให้ปลดล็อกบทเรียนตัวแรกของบทถัดไป
          if (nextChapter) {
            const firstLessonNextChapter = await this.lessonRepository.findOne({
              where: { chapter_id: nextChapter.chapter_id, isPublished: true },
              order: { orderIndex: 'ASC' },
            });

            // ถ้ามีบทเรียนตัวแรกของบทถัดไป ให้ปลดล็อกบทเรียนตัวนั้น
            if (firstLessonNextChapter) {
              let nextChapterProgress = await this.lessonProgressRepository.findOne({
                where: { userId, lessonId: firstLessonNextChapter.lesson_id },
              });

              // ถ้าไม่มีแถว progress สำหรับบทเรียนตัวแรกของบทถัดไป ให้สร้างเป็น IN_PROGRESS
              if (!nextChapterProgress) {
                nextChapterProgress = this.lessonProgressRepository.create({
                  userId,
                  lessonId: firstLessonNextChapter.lesson_id,
                  status: LessonProgressStatus.IN_PROGRESS,
                  progressPercent: 0,
                  mapLessonId: lesson.lesson_id,
                  lastViewedAt: new Date(),
                });
                await this.lessonProgressRepository.save(nextChapterProgress);
              } else if (nextChapterProgress.status === LessonProgressStatus.LOCKED) {
                nextChapterProgress.status = LessonProgressStatus.IN_PROGRESS;
                nextChapterProgress.mapLessonId = nextChapterProgress.mapLessonId ?? lesson.lesson_id;
                nextChapterProgress.lastViewedAt = new Date();
                await this.lessonProgressRepository.save(nextChapterProgress);
              }
            }
          }
        }
      }
    }

    // ดึงบทที่เกี่ยวข้องเพื่อใส่ใน DTO
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: lesson.chapter_id },
    });

    await this.invalidateLearnerHomeCache(userId);

    return this.toResponse(saved, {
      chapterId: lesson.chapter_id,
      levelId: chapter?.levelId ?? null,
    });
  }


  async skipLessonAndUnlockNext(userId: string, lessonId: number): Promise<{
    skipped: LessonProgressResponseDto;
    unlockedNext: LessonProgressResponseDto | null;
  }> {
    const currentLesson = await this.lessonRepository.findOne({
      where: { lesson_id: lessonId },
    });

    if (!currentLesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // ถ้าบทเรียนนี้เป็น checkpoint ให้ข้ามบท checkpoint ที่เกี่ยวข้องทั้งหมดด้วย
    if (currentLesson.lesson_type === 'checkpoint') {
      await this.quizService.skipCheckpointsByLesson(lessonId, userId);
    }

    // ดึงหรือสร้างแถว progress สำหรับบทเรียนปัจจุบัน
    let currentProgress = await this.lessonProgressRepository.findOne({
      where: { userId, lessonId },
    });

    // ห้ามข้าม (skip) ถ้าบทเรียนถูกทำเครื่องหมายว่าเสร็จสมบูรณ์แล้ว
    if (currentProgress && currentProgress.status === LessonProgressStatus.COMPLETED) {
      throw new BadRequestException('Cannot skip a completed lesson');
    }

    // ถ้าไม่มีแถว ให้สร้างใหม่
    if (!currentProgress) {
      currentProgress = this.lessonProgressRepository.create({
        userId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        progressPercent: 0,
      });
    }

    const previousStatus = currentProgress.status;

    // อัปเดตสถานะเป็น SKIPPED
    currentProgress.status = LessonProgressStatus.SKIPPED;
    currentProgress.progressPercent = 100;
    currentProgress.lastViewedAt = new Date();
    currentProgress.completedAt = new Date();

    // บันทึกแถวปัจจุบัน
    const savedCurrent = await this.lessonProgressRepository.save(currentProgress);

    // เพิ่ม streak เฉพาะเมื่อเปลี่ยนสถานะเป็น SKIPPED เป็นครั้งแรก
    const wasCompleted = previousStatus === LessonProgressStatus.COMPLETED || previousStatus === LessonProgressStatus.SKIPPED;
    if (!wasCompleted) {
      await this.streakService.bumpStreak(userId, savedCurrent.completedAt ?? new Date());
    }

    // ดึงบทที่เกี่ยวข้องเพื่อใส่ใน DTO
    const currentChapter = await this.chapterRepository.findOne({
      where: { chapter_id: currentLesson.chapter_id },
    });
    const currentLevelId = currentChapter?.levelId ?? null;

    // ตรวจสอบบทเรียนถัดไปในบทเดียวกัน
    const nextLesson = await this.lessonRepository.findOne({
      where: {
        chapter_id: currentLesson.chapter_id,
        orderIndex: MoreThan(currentLesson.orderIndex),
        isPublished: true,
      },
      order: { orderIndex: 'ASC' },
    });

    // ถ้าไม่มีบทเรียนถัดไปในบทเดียวกัน ให้พยายามปลดล็อกบทถัดไปของ -> บทถัดไป
    if (!nextLesson) {
      let unlockedNextProgress: LessonProgress | null = null;
      let unlockedChapterId: number | null = null;
      let unlockedLevelId: number | null = null;

      // ตรวจสอบว่า chapter ปัจจุบันถูกทำครบจริงก่อน (ถ้ายังไม่ครบ ห้ามปลดล็อก chapter ถัดไป)
      const chapterCompleted = await this.isChapterCompletedForUser(userId, currentLesson.chapter_id);
      if (!chapterCompleted) {
        await this.invalidateLearnerHomeCache(userId);
        return {
          skipped: this.toResponse(savedCurrent, {
            chapterId: currentLesson.chapter_id,
            levelId: currentLevelId,
          }),
          unlockedNext: null,
        };
      }

      // ถ้า chapter ปัจจุบันถูกทำครบแล้ว ให้ปลดล็อกบทเรียนตัวแรกของบทถัดไป
      if (currentChapter) {
        const nextChapter = await this.chapterRepository.findOne({
          where: {
            levelId: currentChapter.levelId,
            chapter_orderIndex: MoreThan(currentChapter.chapter_orderIndex ?? 0),
          },
          order: { chapter_orderIndex: 'ASC' },
        });

        // ถ้ามีบทถัดไปในระดับเดียวกัน ให้ปลดล็อกบทเรียนตัวแรกของบทถัดไป
        if (nextChapter) {
          const firstLessonNextChapter = await this.lessonRepository.findOne({
            where: { chapter_id: nextChapter.chapter_id, isPublished: true },
            order: { orderIndex: 'ASC' },
          });

          // ถ้ามีบทเรียนตัวแรกของบทถัดไป ให้ปลดล็อกบทเรียนตัวนั้น
          if (firstLessonNextChapter) {
            let nextChapterProgress = await this.lessonProgressRepository.findOne({
              where: { userId, lessonId: firstLessonNextChapter.lesson_id },
            });

            // ถ้าไม่มีแถว progress สำหรับบทเรียนตัวแรกของบทถัดไป ให้สร้างเป็น IN_PROGRESS
            if (!nextChapterProgress) {
              nextChapterProgress = this.lessonProgressRepository.create({
                userId,
                lessonId: firstLessonNextChapter.lesson_id,
                status: LessonProgressStatus.IN_PROGRESS,
                progressPercent: 0,
                mapLessonId: lessonId,
                lastViewedAt: new Date(),
              });
              nextChapterProgress = await this.lessonProgressRepository.save(nextChapterProgress);

              // ถ้าแถว progress มีสถานะเป็น LOCKED ให้เปลี่ยนเป็น IN_PROGRESS
            } else if (nextChapterProgress.status === LessonProgressStatus.LOCKED) {
              nextChapterProgress.status = LessonProgressStatus.IN_PROGRESS;
              nextChapterProgress.mapLessonId = nextChapterProgress.mapLessonId ?? lessonId;
              nextChapterProgress.lastViewedAt = new Date();
              nextChapterProgress = await this.lessonProgressRepository.save(nextChapterProgress);
            }

            // ถ้าได้แถว progress มาแล้ว (ไม่ว่าจะเป็นแถวใหม่หรือแถวที่อัปเดต) ให้เตรียมข้อมูลสำหรับส่งกลับ
            if (nextChapterProgress) {
              unlockedNextProgress = nextChapterProgress;
              unlockedChapterId = firstLessonNextChapter.chapter_id;
              unlockedLevelId = nextChapter.levelId ?? null;
            }
          }
        }
      }

      // ส่งกลับข้อมูลความคืบหน้า
      await this.invalidateLearnerHomeCache(userId);
      return {
        skipped: this.toResponse(savedCurrent, {
          chapterId: currentLesson.chapter_id,
          levelId: currentLevelId,
        }),
        unlockedNext: unlockedNextProgress
          ? this.toResponse(unlockedNextProgress, {
            chapterId: unlockedChapterId,
            levelId: unlockedLevelId,
          })
          : null,
      };
    }

    // จัดการบทเรียนถัดไป
    let nextProgress = await this.lessonProgressRepository.findOne({
      where: { userId, lessonId: nextLesson.lesson_id },
    });

    // ถ้าไม่มีแถว progress สำหรับบทเรียนถัดไป ให้สร้างเป็น IN_PROGRESS
    if (!nextProgress) {
      nextProgress = this.lessonProgressRepository.create({
        userId,
        lessonId: nextLesson.lesson_id,
        status: LessonProgressStatus.IN_PROGRESS,
        progressPercent: 0,
        mapLessonId: lessonId,
        lastViewedAt: new Date(),
      });

      nextProgress = await this.lessonProgressRepository.save(nextProgress);
    }
    // ถ้าเป็น LOCKED ให้เปลี่ยนเป็น IN_PROGRESS
    else if (nextProgress.status === LessonProgressStatus.LOCKED) {
      nextProgress.status = LessonProgressStatus.IN_PROGRESS;
      nextProgress.lastViewedAt = new Date();

      // ถ้า mapLessonId ยังไม่มีค่า ให้ตั้งเป็น lessonId ของบทเรียนที่เพิ่งข้าม
      if (nextProgress.mapLessonId == null) {
        nextProgress.mapLessonId = lessonId;
      }
      nextProgress = await this.lessonProgressRepository.save(nextProgress);
    }

    // ดึงบทที่เกี่ยวข้องกับบทเรียนถัดไป
    const nextChapter = nextLesson.chapter_id === currentLesson.chapter_id
      ? currentChapter
      : await this.chapterRepository.findOne({
        where: { chapter_id: nextLesson.chapter_id },
      });
    const nextLevelId = nextChapter?.levelId ?? null;

    // ส่งกลับข้อมูลความคืบหน้า
    await this.invalidateLearnerHomeCache(userId);
    return {
      skipped: this.toResponse(savedCurrent, {
        chapterId: currentLesson.chapter_id,
        levelId: currentLevelId,
      }),
      unlockedNext: this.toResponse(nextProgress, {
        chapterId: nextLesson.chapter_id,
        levelId: nextLevelId,
      }),
    };
  }

  private async invalidateLearnerHomeCache(userId: string): Promise<void> {
    if (!this.redisCacheService) {
      return;
    }

    await this.redisCacheService.deleteByPrefix(`learner-home:user:${userId}:`);
  }

  // ดึงความคืบหน้าของบทเรียนทั้งหมดในบทเดียว
  async getChapterProgress(userId: string, chapterId: number): Promise<ChapterProgressDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${chapterId} not found`);
    }

    // ดึงบทเรียนทั้งหมดในบทนั้น
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId, isPublished: true },
      order: { orderIndex: 'ASC' },
    });

    // ถ้าไม่มีบทเรียนเลย ให้คืนค่า progress เป็น 0%
    if (lessons.length === 0) {
      return {
        chapterId,
        totalItems: 0,
        completedItems: 0,
        percent: 0,
        resumeLessonId: null,
      };
    }

    // ดึง IDs ของบทเรียน
    const lessonIds = lessons.map((l) => l.lesson_id);

    // function ตรวจสอบว่าบทนี้ถูกปลดล็อกสำหรับผู้ใช้หรือไม่
    const isUnlocked = await this.isChapterUnlockedForUser(
      userId,
      chapter,
      lessonIds,
    );

    // ถ้าไม่ถูกปลดล็อก ให้คืนค่า progress เป็น 0%
    if (!isUnlocked) {
      return {
        chapterId,
        totalItems: lessons.length,
        completedItems: 0,
        percent: 0,
        resumeLessonId: null,
      };
    }

    // ดึงแถว progress สำหรับบทเรียนเหล่านั้น
    const progressRows = await this.lessonProgressRepository.find({
      where: { userId, lessonId: In(lessonIds) },
    });

    // map progress ตาม lessonId เพื่อให้เข้าถึงได้ง่ายเมื่อคำนวณสรุปความคืบหน้าของบทเรียนแต่ละบท
    const progressByLessonId = new Map(
      progressRows.map((p) => [p.lessonId, p] as const),
    );

    // คำนวณจำนวนบทเรียนที่เสร็จสมบูรณ์แล้ว (COMPLETED หรือ SKIPPED)
    const completedSet = new Set(
      progressRows
        .filter(
          (p) =>
            p.status === LessonProgressStatus.COMPLETED ||
            p.status === LessonProgressStatus.SKIPPED,
        )
        .map((p) => p.lessonId),
    );

    const completedItems = completedSet.size;

    const totalItems = lessons.length;

    // คำนวณเปอร์เซ็นต์ความคืบหน้าของบทนี้โดยเฉลี่ยจากทุกบทเรียน (COMPLETED/SKIPPED = 100, ใช้ progressPercent เมื่อมี, ค่าว่าง = 0)
    let sumPercent = 0;
    for (const lesson of lessons) {
      const progress = progressByLessonId.get(lesson.lesson_id);
      if (progress) {
        if (
          progress.status === LessonProgressStatus.COMPLETED ||
          progress.status === LessonProgressStatus.SKIPPED
        ) {
          sumPercent += 100;
        } else if (progress.progressPercent != null && !Number.isNaN(Number(progress.progressPercent))) {
          sumPercent += Math.round(Number(progress.progressPercent));
        } else {
          sumPercent += 0;
        }
      } else {
        sumPercent += 0;
      }
    }

    const percent = totalItems > 0 ? Math.round(sumPercent / totalItems) : 0;

    // ถ้ามีบทเรียนที่กำลังทำอยู่ (IN_PROGRESS) ให้แนะนำให้กลับไปที่บทเรียนนั้นก่อน
    const inProgress = lessons.find(
      (l) => progressByLessonId.get(l.lesson_id)?.status === LessonProgressStatus.IN_PROGRESS,
    );

    // ถ้าไม่มีบทเรียนที่กำลังทำอยู่ ให้แนะนำบทเรียนแรกที่ยังไม่เสร็จสมบูรณ์ ถ้าบทเรียนนั้นถูกล็อกอยู่ ให้ไม่แนะนำบทเรียนนั้น
    if (inProgress) {
      return {
        chapterId,
        totalItems,
        completedItems,
        percent,
        resumeLessonId: inProgress.lesson_id,
      };
    }

    const firstNotDone = lessons.find((l) => !completedSet.has(l.lesson_id));
    const resumeLessonId = firstNotDone
      ? (progressByLessonId.get(firstNotDone.lesson_id)?.status === LessonProgressStatus.LOCKED
        ? null
        : firstNotDone.lesson_id)
      : null;

    return {
      chapterId,
      totalItems,
      completedItems,
      percent,
      resumeLessonId,
    };
  }

  // ดึง roadmap ของบทเรียนทั้งหมดในบทเดียว พร้อมสถานะของแต่ละบทเรียน
  async getChapterRoadmap(userId: string, chapterId: number): Promise<ChapterRoadmapDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: chapterId }
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${chapterId} not found`);
    }

    // ดึงบทเรียนทั้งหมดในบทนั้น
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId, isPublished: true },
      order: { orderIndex: 'ASC' }
    });

    // ถ้าไม่มีบทเรียนเลย ให้คืนค่า roadmap ว่าง
    if (lessons.length === 0) {
      return {
        chapterId,
        chapterTitle: chapter.chapter_title,
        progressPercent: 0,
        items: [],
        nextAvailableLessonId: null,
      };
    }

    // ดึง IDs ของบทเรียน
    const lessonIds = lessons.map((l) => l.lesson_id);

    // ตรวจสอบว่าบทนี้ถูกปลดล็อกสำหรับผู้ใช้หรือไม่
    const isUnlocked = await this.isChapterUnlockedForUser(
      userId,
      chapter,
      lessonIds,
    );

    // ถ้าไม่ถูกปลดล็อก ให้คืนค่า roadmap ที่มีสถานะ LOCKED ทั้งหมด
    if (!isUnlocked) {
      const items: ItemStatusDto[] = lessons.map((lesson) => ({
        lessonId: lesson.lesson_id,
        lessonTitle: lesson.lesson_title,
        lessonType: lesson.lesson_type,
        isPublished: lesson.isPublished,
        status: LessonProgressStatus.LOCKED,
        progressPercent: 0,
        positionSeconds: null,
        durationSeconds: null,
        completedAt: null,
        orderIndex: lesson.orderIndex,
      }));

      // คืนค่า roadmap ทั้งหมดเป็น LOCKED
      return {
        chapterId,
        chapterTitle: chapter.chapter_title,
        progressPercent: 0,
        nextAvailableLessonId: null,
        items,
      };
    }

    // ดึงแถว progress สำหรับบทเรียนเหล่านั้น
    const progressRows = await this.lessonProgressRepository.find({
      where: { userId, lessonId: In(lessonIds) },
    });

    // ถ้าไม่มีแถว progress เลย ให้สร้างแถวเริ่มต้นสำหรับบทเรียนแรก
    if (progressRows.length === 0) {
      const firstLesson = lessons[0];

      // สร้างแถว progress สำหรับบทเรียนแรกเป็น IN_PROGRESS
      await this.lessonProgressRepository.save(
        this.lessonProgressRepository.create({
          userId,
          lessonId: firstLesson.lesson_id,
          status: LessonProgressStatus.IN_PROGRESS,
          progressPercent: 0,
          lastViewedAt: new Date(),
        }),
      );

      // สร้างแถว progress สำหรับบทเรียนที่สองเป็น LOCKED (ถ้ามี)
      const secondLesson = lessons[1];
      if (secondLesson) {
        await this.lessonProgressRepository.save(
          this.lessonProgressRepository.create({
            userId,
            lessonId: secondLesson.lesson_id,
            status: LessonProgressStatus.LOCKED,
            progressPercent: 0,
            mapLessonId: firstLesson.lesson_id,
          }),
        );
      }

      // อ่านข้อมูลใหม่หลังจากการเริ่มต้น
      const refreshed = await this.lessonProgressRepository.find({
        where: { userId, lessonId: In(lessonIds) },
      });
      progressRows.splice(0, progressRows.length, ...refreshed);
    }

    let nextAvailableLessonId: number | null = null;

    // สร้างรายการสถานะของแต่ละบทเรียนในบทนี้ โดยใช้ข้อมูลจาก progressRows เพื่อกำหนดสถานะและเปอร์เซ็นต์ความคืบหน้าของแต่ละบทเรียน
    const items: ItemStatusDto[] = lessons.map((lesson) => {
      const progress = progressRows.find(
        (p) => p.lessonId === lesson.lesson_id,
      );

      // กำหนดสถานะบทเรียน ถัดไปที่สามารถเข้าถึงได้
      const status = progress?.status ?? LessonProgressStatus.LOCKED;

      // ถ้าไม่มีบทเรียนที่กำลังทำอยู่ ให้แนะนำบทเรียนแรกที่ยังไม่เสร็จสมบูรณ์ ถ้าบทเรียนนั้นถูกล็อกอยู่ ให้ไม่แนะนำบทเรียนนั้น
      if (
        nextAvailableLessonId == null &&
        status === LessonProgressStatus.IN_PROGRESS
      ) {
        nextAvailableLessonId = lesson.lesson_id;
      }

      return {
        lessonId: lesson.lesson_id,
        lessonTitle: lesson.lesson_title,
        lessonType: lesson.lesson_type,
        isPublished: lesson.isPublished,
        status,
        progressPercent: status === LessonProgressStatus.COMPLETED || status === LessonProgressStatus.SKIPPED
          ? 100
          : (progress?.progressPercent != null &&
            !Number.isNaN(Number(progress.progressPercent))
            ? Math.round(Number(progress.progressPercent))
            : 0),
        positionSeconds: progress?.positionSeconds ?? null,
        durationSeconds: progress?.durationSeconds ?? null,
        completedAt: progress?.completedAt ?? null,
        orderIndex: lesson.orderIndex,
      };
    });

    const totalItems = lessons.length;

    // คำนวณเปอร์เซ็นต์ความคืบหน้าของบทนี้โดยเฉลี่ยจากทุกบทเรียน (COMPLETED/SKIPPED = 100, ใช้ progressPercent เมื่อมี, ค่าว่าง = 0)
    const sumAll = items.reduce((acc, item) => acc + (Number(item.progressPercent) || 0), 0);
    const progressPercent = totalItems > 0 ? Math.round(sumAll / totalItems) : 0;

    // ดึงสถานะ streak ของผู้ใช้เพื่อแสดงใน roadmap ด้วย
    const { isReward, isFlameOn } = await this.streakService.getStreak(userId);
    const streakStatus: 'IN_PROGRESS' | 'COMPLETE' = isFlameOn ? 'COMPLETE' : 'IN_PROGRESS';

    return {
      chapterId,
      chapterTitle: chapter.chapter_title,
      progressPercent,
      nextAvailableLessonId,
      items,
      streakStatus,
      isReward,
    };
  }

  // ดึง roadmap ของบทเรียนทั้งหมดในระดับเดียว พร้อมสถานะของแต่ละบทเรียน
  async getLevelChapterRoadmaps(userId: string, levelId: number): Promise<ChapterRoadmapDto[]> {
    const chapters = await this.chapterRepository.find({
      where: { levelId },
      order: { chapter_orderIndex: 'ASC' },
    });

    // ถ้าไม่มีบทเลย ให้คืนค่า roadmap ว่าง
    if (!chapters || chapters.length === 0) return [];

    // ดึง roadmap ของแต่ละบทในระดับนี้พร้อมกัน
    const promises = chapters.map((c) => this.getChapterRoadmap(userId, c.chapter_id));
    return Promise.all(promises);
  }

  // ฟังก์ชันช่วยแปลงแถว progress เป็น DTO สำหรับส่งกลับใน API
  private toResponse(
    row: LessonProgress,
    location?: { chapterId?: number | null; levelId?: number | null },
  ): LessonProgressResponseDto {
    const isDone =
      row.status === LessonProgressStatus.COMPLETED ||
      row.status === LessonProgressStatus.SKIPPED;

    return {
      lessonId: row.lessonId,
      chapterId: location?.chapterId ?? null,
      levelId: location?.levelId ?? null,
      userId: row.userId,
      status: row.status,
      progressPercent:
        isDone
          ? 100
          : (row.progressPercent != null &&
            !Number.isNaN(Number(row.progressPercent))
            ? Math.round(Number(row.progressPercent))
            : null),
      positionSeconds: row.positionSeconds ?? null,
      durationSeconds: row.durationSeconds ?? null,
      lastViewedAt: row.lastViewedAt ?? null,
      completedAt: row.completedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // function ตรวจสอบว่าบทนี้ถูกปลดล็อกสำหรับผู้ใช้หรือไม่
  private async isChapterUnlockedForUser(
    userId: string,
    chapter: Chapter,
    chapterLessonIds: number[],
  ): Promise<boolean> {
    // ถ้าไม่มีบทเรียนในบทนี้ ให้ถือว่าเป็นบทที่ปลดล็อกแล้ว
    if (chapterLessonIds.length > 0) {
      const existing = await this.lessonProgressRepository.findOne({
        where: { userId, lessonId: In(chapterLessonIds) },
      });
      if (existing) {
        return true;
      }
    }

    // ตรวจสอบบทก่อนหน้าภายในระดับเดียวกัน
    const prevChapter = await this.chapterRepository.findOne({
      where: {
        levelId: chapter.levelId,
        chapter_orderIndex: LessThan(chapter.chapter_orderIndex),
      },
      order: { chapter_orderIndex: 'DESC' },
    });

    if (!prevChapter) {
      return true;
    }

    return this.isChapterCompletedForUser(userId, prevChapter.chapter_id);
  }

  // function ตรวจสอบว่าบทนี้เสร็จสมบูรณ์สำหรับผู้ใช้หรือไม่
  private async isChapterCompletedForUser(
    userId: string,
    chapterId: number,
  ): Promise<boolean> {
    // ดึงบทเรียนทั้งหมดในบทนั้น
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId, isPublished: true },
      order: { orderIndex: 'ASC' },
    });

    // ถ้าไม่มีบทเรียนเลย ให้ถือว่าเป็นบทที่เสร็จสมบูรณ์แล้ว
    if (lessons.length === 0) {
      return true;
    }

    // ดึงแถว progress สำหรับบทเรียนนั้น
    const lessonIds = lessons.map((l) => l.lesson_id);
    const progressRows = await this.lessonProgressRepository.find({
      where: { userId, lessonId: In(lessonIds) },
    });

    // ตรวจสอบว่าบทเรียนทั้งหมดถูกทำเครื่องหมายว่าเสร็จสมบูรณ์หรือไม่
    const completed = new Set(
      progressRows
        .filter(
          (p) =>
            p.status === LessonProgressStatus.COMPLETED ||
            p.status === LessonProgressStatus.SKIPPED,
        )
        .map((p) => p.lessonId),
    );

    return completed.size === lessonIds.length;
  }
}