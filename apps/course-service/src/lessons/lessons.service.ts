import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson, LessonType } from './entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { Article } from '../articles/entities/article.entity';
import { Quizs } from '../quizs/entities/quizs.entity';
import { QuizsCheckpoint } from '../quizs/entities/checkpoint.entity';
import { VideoAsset } from '../media-videos/entities/video.entity';
import { CreateLessonDto, UpdateLessonDto, LessonResponseDto } from './dto/lesson';
import { Level } from '../levels/entities/level.entity';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    @InjectRepository(Quizs)
    private readonly quizRepo: Repository<Quizs>,
    @InjectRepository(QuizsCheckpoint)
    private readonly checkpointRepository: Repository<QuizsCheckpoint>,
    @InjectRepository(VideoAsset)
    private readonly videoRepo: Repository<VideoAsset>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    private readonly coursesService: CoursesService,
  ) { }

  async create(createLessonDto: CreateLessonDto): Promise<LessonResponseDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: createLessonDto.chapter_id },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${createLessonDto.chapter_id} not found`);
    }

    // ดึง lessons ทั้งหมดใน chapter เรียงตามลำดับ
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: createLessonDto.chapter_id },
      order: { orderIndex: 'ASC' },
    });

    let orderIndex: number;

    // กัน checkpoint ไม่ให้ไปอยู่กลาง chapter
    const existingCheckpoint = lessons.find(
      (l) => l.lesson_type === LessonType.CHECKPOINT,
    );

    if (createLessonDto.lesson_type === LessonType.CHECKPOINT) {
      // ถ้ามี checkpoint เดิม → ลบทิ้งก่อน
      if (existingCheckpoint) {
        await this.lessonRepository.remove(existingCheckpoint);
        orderIndex = lessons.length - 1; // checkpoint ใหม่จะอยู่ท้ายสุดเสมอ
      } else {
        orderIndex = lessons.length; // checkpoint ใหม่จะอยู่ท้ายสุดเสมอ
      }
    } else {

      // ถ้าไม่ใช่ checkpoint → แทรกก่อน checkpoint
      if (existingCheckpoint) {
        orderIndex = existingCheckpoint.orderIndex;

        // ขยับ checkpoint ลงไป 1 ตำแหน่ง
        existingCheckpoint.orderIndex += 1;
        await this.lessonRepository.save(existingCheckpoint);
      } else {
        orderIndex = lessons.length;
      }
    }

    const isPublished = this.resolveInitialPublishedState(createLessonDto);

    const lesson = this.lessonRepository.create({
      lesson_title: createLessonDto.lesson_title,
      lesson_description: createLessonDto.lesson_description,
      chapter_id: createLessonDto.chapter_id,
      lesson_type: createLessonDto.lesson_type,
      orderIndex: orderIndex,
      lesson_ImageUrl: createLessonDto.lesson_ImageUrl,
      lesson_videoUrl: createLessonDto.lesson_videoUrl,
      isPublished,
    });

    const saved = await this.lessonRepository.save(lesson);

    await this.syncChapterIsPublished(saved.chapter_id);
    await this.invalidateCourseCache(saved.chapter_id);

    return this.toResponseDto(saved);
  }

  async findByChapter(chapterId: number): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId },
      order: { orderIndex: 'ASC' },
    });

    return Promise.all(lessons.map((l) => this.toResponseDto(l)));
  }

  async findPublishedByChapter(chapterId: number): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId, isPublished: true },
      order: { orderIndex: 'ASC' },
    });

    return Promise.all(lessons.map((l) => this.toResponseDto(l)));
  }

  async findAll(): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonRepository.find({
      order: { orderIndex: 'ASC' },
    });

    return Promise.all(lessons.map((l) => this.toResponseDto(l)));
  }

  async findAllPublished(): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonRepository.find({
      where: { isPublished: true },
      order: { orderIndex: 'ASC' },
    });

    return Promise.all(lessons.map((l) => this.toResponseDto(l)));
  }

  async findOne(id: number): Promise<LessonResponseDto> {
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    // ถ้า lesson ยังไม่ publish ให้เช็คว่า content ตาม type มีอยู่จริง
    if (!lesson.isPublished) {
      switch (lesson.lesson_type) {
        case LessonType.ARTICLE: {
          const article = await this.articleRepo.findOne({
            where: { lesson: { lesson_id: lesson.lesson_id } },
          });
          if (!article) {
            throw new NotFoundException(
              `Article content for lesson ID ${id} not found`,
            );
          }
          break;
        }
        case LessonType.QUIZ: {
          const quiz = await this.quizRepo.findOne({
            where: { lesson: { lesson_id: lesson.lesson_id } },
          });
          if (!quiz) {
            throw new NotFoundException(
              `Quiz content for lesson ID ${id} not found`,
            );
          }
          break;
        }
        case LessonType.CHECKPOINT: {
          const checkpoint = await this.checkpointRepository.findOne({
            where: { lesson: { lesson_id: lesson.lesson_id } },
          });
          if (!checkpoint) {
            throw new NotFoundException(
              `Checkpoint content for lesson ID ${id} not found`,
            );
          }
          break;
        }
        default:
          break;
      }
    }

    return this.toResponseDto(lesson);
  }

  async findOnePublished(id: number): Promise<LessonResponseDto> {
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: id, isPublished: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return this.toResponseDto(lesson);
  }

  async findOneAdmin(id: number): Promise<LessonResponseDto> {
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return this.toResponseDto(lesson);
  }

  // Update lesson by ID
  async update(id: number, updateLessonDto: UpdateLessonDto): Promise<LessonResponseDto> {
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    const originalType = lesson.lesson_type;

    // Update fields if provided
    if (updateLessonDto.lesson_title !== undefined) {
      lesson.lesson_title = updateLessonDto.lesson_title;
    }

    if (updateLessonDto.lesson_description !== undefined) {
      lesson.lesson_description = updateLessonDto.lesson_description;
    }

    if (updateLessonDto.lesson_ImageUrl !== undefined) {
      lesson.lesson_ImageUrl = updateLessonDto.lesson_ImageUrl;
    }

    if (updateLessonDto.lesson_videoUrl !== undefined) {
      lesson.lesson_videoUrl = updateLessonDto.lesson_videoUrl;
    }

    const nextLessonType = updateLessonDto.lesson_type ?? lesson.lesson_type;
    const isChangingToCheckpoint =
      updateLessonDto.lesson_type !== undefined &&
      updateLessonDto.lesson_type === LessonType.CHECKPOINT &&
      updateLessonDto.lesson_type !== originalType;

    // ถ้าเปลี่ยน type ตรวจสอบและจัดการความสัมพันธ์ของ content ตาม type ใหม่
    if (
      updateLessonDto.lesson_type !== undefined &&
      updateLessonDto.lesson_type !== originalType
    ) {
      const lessons = await this.lessonRepository.find({
        where: { chapter_id: lesson.chapter_id },
        order: { orderIndex: 'ASC' },
      });

      const existingCheckpoint = lessons.find(
        (l) =>
          l.lesson_type === LessonType.CHECKPOINT &&
          l.lesson_id !== lesson.lesson_id,
      );

      // ถ้าเปลี่ยนเป็น checkpoint -> ลบ checkpoint เดิมทิ้งก่อน
      if (updateLessonDto.lesson_type === LessonType.CHECKPOINT) {
        if (existingCheckpoint) {
          await this.lessonRepository.remove(existingCheckpoint);
        }

        // ย้าย lesson นี้ไปท้ายสุดเสมอ
        lesson.orderIndex = lessons.length - 1;
      }

      lesson.lesson_type = updateLessonDto.lesson_type;
    }

    if (isChangingToCheckpoint) {
      lesson.isPublished = false;
    } else {
      lesson.isPublished = await this.resolveUpdatedPublishedState(
        lesson,
        updateLessonDto.isPublished,
      );
    }

    // ถ้า update orderIndex ให้ตรวจสอบว่าไม่ใช่ checkpoint และไม่ให้ไปอยู่กลาง chapter
    if (updateLessonDto.orderIndex !== undefined &&
      lesson.lesson_type !== LessonType.CHECKPOINT
    ) {
      lesson.orderIndex = updateLessonDto.orderIndex;
    }

    const saved = await this.lessonRepository.save(lesson);

    await this.syncChapterIsPublished(saved.chapter_id);
    await this.invalidateCourseCache(saved.chapter_id);

    return this.toResponseDto(saved);
  }

  // Delete lesson by ID
  async remove(id: number): Promise<{ message: string }> {
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    const chapterId = lesson.chapter_id;
    await this.lessonRepository.remove(lesson);
    await this.syncChapterIsPublished(chapterId);
    await this.invalidateCourseCache(chapterId);
    return { message: `Lesson with ID ${id} deleted successfully` };
  }

  // reorder lessons within a chapter
  async reorder(chapterId: number, lessonIds: number[]): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonRepository.find({
      where: { chapter_id: chapterId },
    });

    // ถ้าไม่มีบทเรียนในบทนี้เลย ให้คืนค่าเป็น array ว่างแทน
    if (lessons.length === 0) {
      return [];
    }

    // เช็คว่า lessonIds ที่ส่งมาครบถ้วนและถูกต้องมั้ย
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      throw new BadRequestException('lessonIds is required');
    }

    // กันไม่ให้ส่ง lessonIds มาเกินจำนวนบทเรียนที่มีอยู่จริง
    if (lessonIds.length !== lessons.length) {
      throw new BadRequestException(
        `lessonIds must include all lessons in the chapter (expected ${lessons.length}, got ${lessonIds.length})`,
      );
    }

    // กันไม่ให้ส่ง lessonIds ที่ไม่ใช่ของบทนี้มาด้วย
    const lessonMap = new Map(lessons.map((l) => [l.lesson_id, l]));

    for (const id of lessonIds) {
      if (!lessonMap.has(id)) {
        throw new BadRequestException(`Lesson ID ${id} does not belong to chapter ${chapterId}`);
      }
    }

    const checkpoint = lessons.find(
      (l) => l.lesson_type === LessonType.CHECKPOINT,
    );

    if (checkpoint) {
      const lastId = lessonIds[lessonIds.length - 1];

      if (checkpoint.lesson_id !== lastId) {
        throw new BadRequestException(
          'Checkpoint must always be the last lesson in the chapter',
        );
      }
    }

    const updatedLessons: Lesson[] = [];

    // อัพเดท orderIndex ตามลำดับใน lessonIds
    for (let i = 0; i < lessonIds.length; i++) {
      const lesson = lessonMap.get(lessonIds[i]);
      if (lesson) {
        lesson.orderIndex = i;
        updatedLessons.push(lesson);
      }
    }

    await this.lessonRepository.save(updatedLessons);
    await this.invalidateCourseCache(chapterId);

    return await this.findByChapter(chapterId);
  }

  // แปลง Lesson entity เป็น LessonResponseDto โดยถ้าเป็น checkpoint จะเติมข้อมูล checkpoint ลงไปใน response ด้วย
  private async toResponseDto(lesson: Lesson): Promise<LessonResponseDto> {
    const base: any = {
      lesson_id: lesson.lesson_id,
      lesson_title: lesson.lesson_title,
      lesson_description: lesson.lesson_description ?? undefined,
      lesson_type: lesson.lesson_type,
      orderIndex: lesson.orderIndex,
      chapter_id: lesson.chapter_id,
      lesson_ImageUrl: lesson.lesson_ImageUrl,
      lesson_videoUrl: lesson.lesson_videoUrl,
      isPublished: lesson.isPublished,
      createdAt: lesson.createdAt,
    };

    if (lesson.lesson_type === LessonType.CHECKPOINT) {
      try {
        const checkpoint = await this.checkpointRepository.findOne({
          where: { lessonId: lesson.lesson_id },
        });

        if (checkpoint) {
          base.checkpoint = {
            checkpoint_id: checkpoint.checkpointId,
            checkpoint_score: checkpoint.checkpointScore,
            checkpoint_type: checkpoint.checkpointType,
            checkpoint_questions: checkpoint.checkpointQuestions,
            checkpoint_option: checkpoint.checkpointOption,
            checkpoint_answer: checkpoint.checkpointAnswer,
            checkpoint_explanation: checkpoint.checkpointExplanation,
            createdAt: checkpoint.createdAt,
            updatedAt: checkpoint.updatedAt,
          };
        }
      } catch {
        // Ignore checkpoint enrichment errors and return base lesson data.
      }
    }

    return base as LessonResponseDto;
  }

  private async syncChapterIsPublished(chapterId: number): Promise<void> {
    const hasPublishedLesson = await this.lessonRepository.exist({
      where: { chapter_id: chapterId, isPublished: true },
    });

    await this.chapterRepository.update(chapterId, {
      isPublished: hasPublishedLesson,
    });
  }

  // ล้าง cache โครงสร้างคอร์สเมื่อ lesson เปลี่ยน
  private async invalidateCourseCache(chapterId: number): Promise<void> {
    const chapter = await this.chapterRepository.findOne({ where: { chapter_id: chapterId } });
    if (!chapter) return;
    const level = await this.levelRepository.findOne({ where: { level_id: chapter.levelId } });
    if (!level) return;
    await this.coursesService.invalidateCourseCaches(level.course_id);
  }

  private resolveInitialPublishedState(createLessonDto: CreateLessonDto): boolean {
    if (!createLessonDto.isPublished) {
      return false;
    }

    if (createLessonDto.lesson_type === LessonType.CHECKPOINT) {
      return false;
    }

    if (createLessonDto.lesson_type === LessonType.VIDEO) {
      return Boolean(createLessonDto.lesson_videoUrl?.trim());
    }

    return false;
  }

  private async resolveUpdatedPublishedState(
    lesson: Lesson,
    requestedPublished?: boolean,
  ): Promise<boolean> {
    const hasContent = await this.hasPublishableContent(lesson);

    if (requestedPublished === undefined) {
      return hasContent ? lesson.isPublished : false;
    }

    if (!requestedPublished) {
      return false;
    }

    if (!hasContent) {
      throw new BadRequestException(
        `Cannot publish ${lesson.lesson_type} lesson ${lesson.lesson_id} without content.`,
      );
    }

    return true;
  }

  private async hasPublishableContent(lesson: Lesson): Promise<boolean> {
    switch (lesson.lesson_type) {
      case LessonType.ARTICLE: {
        const article = await this.articleRepo.findOne({
          where: { lesson: { lesson_id: lesson.lesson_id } },
        });
        return Boolean(article);
      }
      case LessonType.QUIZ: {
        const quiz = await this.quizRepo.findOne({
          where: { lesson: { lesson_id: lesson.lesson_id } },
        });
        return Boolean(quiz);
      }
      case LessonType.CHECKPOINT:
        return this.checkpointRepository.exist({
          where: { lessonId: lesson.lesson_id },
        });
      case LessonType.VIDEO:
        return Boolean(lesson.lesson_videoUrl?.trim());
      default:
        return false;
    }
  }
}
