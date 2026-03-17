import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CourseResponseDto,
  CourseStructureResponseDto,
  LevelStructureDto,
  ChapterStructureDto,
  LessonStructureDto,
} from './dto';
import { LessonType } from '../lessons/entities/lesson.entity';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class CoursesService {
  private static readonly LIST_TTL_SECONDS = 300;
  private static readonly DETAIL_TTL_SECONDS = 300;
  private static readonly STRUCTURE_TTL_SECONDS = 300;

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @Optional()
    private readonly redisCacheService?: RedisCacheService,
  ) {}

  async create(createCourseDto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = this.courseRepository.create({
      course_ownerId: createCourseDto.course_ownerId ?? 0,
      course_title: createCourseDto.course_title,
      course_description: createCourseDto.course_description,
      course_imageUrl: createCourseDto.course_imageUrl,
      course_tags: createCourseDto.course_tags ?? null,
      isPublished: createCourseDto.isPublished ?? false,
    });

    const saved = await this.courseRepository.save(course);
    await this.invalidateCourseCaches(saved.course_id);
    return this.toResponseDto(saved);
  }

  async findAll(params?: {
    isPublished?: boolean;
    course_ownerId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<CourseResponseDto[]> {
    const cacheKey = this.getListCacheKey(params);

    if (!this.redisCacheService) {
      return this.findAllWithoutCache(params);
    }

    return this.redisCacheService.wrap(
      cacheKey,
      CoursesService.LIST_TTL_SECONDS,
      async () => this.findAllWithoutCache(params),
    );
  }

  async findOne(id: number): Promise<CourseResponseDto> {
    const cacheKey = `course:detail:${id}`;

    if (!this.redisCacheService) {
      return this.findOneWithoutCache(id);
    }

    return this.redisCacheService.wrap(
      cacheKey,
      CoursesService.DETAIL_TTL_SECONDS,
      async () => this.findOneWithoutCache(id),
    );
  }

  // ดึงโครงสร้างแบบ nested ทั้งหมดของคอร์ส (ระดับ -> บท -> บทเรียน) พร้อมข้อมูล checkpoint ของบทเรียนที่เป็นประเภท checkpoint
  async getStructure(id: number): Promise<CourseStructureResponseDto> {
    if (!this.redisCacheService) {
      return this.getStructureData(id, false);
    }

    return this.redisCacheService.wrap(
      `course:structure:student:${id}`,
      CoursesService.STRUCTURE_TTL_SECONDS,
      async () => this.getStructureData(id, false),
    );
  }

  // สร้างคอร์สใหม่
  async getStructureAdmin(id: number): Promise<CourseStructureResponseDto> {
    if (!this.redisCacheService) {
      return this.getStructureData(id, true);
    }

    return this.redisCacheService.wrap(
      `course:structure:admin:${id}`,
      CoursesService.STRUCTURE_TTL_SECONDS,
      async () => this.getStructureData(id, true),
    );
  }

  // Update Course by ID
  async update(
    id: number,
    updateCourseDto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { course_id: id },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    // Update fields if specified
    if (updateCourseDto.course_title !== undefined)
      course.course_title = updateCourseDto.course_title;
    if (updateCourseDto.course_description !== undefined)
      course.course_description = updateCourseDto.course_description;
    if (updateCourseDto.course_imageUrl !== undefined)
      course.course_imageUrl = updateCourseDto.course_imageUrl;
    if (updateCourseDto.course_tags !== undefined)
      course.course_tags = updateCourseDto.course_tags ?? null;

    if (updateCourseDto.isPublished !== undefined) {
      course.isPublished = updateCourseDto.isPublished;
    }

    const saved = await this.courseRepository.save(course);
    await this.invalidateCourseCaches(id);
    return this.toResponseDto(saved);
  }

  // Delete Course by ID (Cascade delete จะทำงานลบ Level, Chapter และ Lesson ที่อยู่ภายในคอร์สนี้ทั้งหมดโดยอัตโนมัติ)
  async remove(id: number): Promise<{ message: string }> {
    const course = await this.courseRepository.findOne({
      where: { course_id: id },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    await this.courseRepository.remove(course);
    await this.invalidateCourseCaches(id);
    return { message: `Course with ID ${id} deleted successfully` };
  }

  private async findAllWithoutCache(params?: {
    isPublished?: boolean;
    course_ownerId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<CourseResponseDto[]> {
    const query = this.courseRepository.createQueryBuilder('course');

    // เพิ่ม subquery เพื่อคำนวณจำนวนบททั้งหมดในแต่ละคอร์ส แล้วเลือกคอลัมน์นี้มาด้วยชื่อ course_totalChapter
    query.addSelect(
      (subQuery) =>
        subQuery
          .select('COUNT(ch.chapter_id)', 'cnt')
          .from('chapters', 'ch')
          .innerJoin('levels', 'l', 'l.level_id = ch.level_id')
          .where('l.course_id = course.course_id'),
      'course_totalChapter',
    );

    // กรองตามสถานะการเผยแพร่
    if (params?.isPublished !== undefined) {
      query.andWhere('course.isPublished = :isPublished', {
        isPublished: params.isPublished,
      });
    }

    // กรองตามผู้สร้างคอร์ส
    if (params?.course_ownerId !== undefined) {
      query.andWhere('course.course_ownerId = :course_ownerId', {
        course_ownerId: params.course_ownerId,
      });
    }

    // กรองตามคำค้นในชื่อหรือคำอธิบายคอร์ส (case-insensitive)
    if (params?.search) {
      const keyword = params.search.toLowerCase();
      query.andWhere(
        '(LOWER(course.course_title) LIKE :kw OR LOWER(course.course_description) LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const limit =
      params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 50;
    const offset = params?.offset && params.offset >= 0 ? params.offset : 0;

    query.orderBy('course.createdAt', 'DESC').take(limit).skip(offset);
    const { entities, raw } = await query.getRawAndEntities();

    return entities.map((course, index) => {
      const total = Number(raw[index]?.course_totalChapter ?? 0);
      course.course_totalChapter = Number.isFinite(total) ? total : 0;
      return this.toResponseDto(course);
    });
  }

  private async findOneWithoutCache(id: number): Promise<CourseResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { course_id: id },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return this.toResponseDto(course);
  }

  private async getStructureData(
    id: number,
    includeUnpublishedLessons: boolean,
  ): Promise<CourseStructureResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { course_id: id },
      relations: [
        'course_levels',
        'course_levels.level_chapters',
        'course_levels.level_chapters.lessons',
      ],
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    const sortedLevels = (course.course_levels || []).sort(
      (a, b) => a.level_orderIndex - b.level_orderIndex,
    );

    const lessonIds: number[] = [];
    for (const lvl of sortedLevels) {
      for (const ch of lvl.level_chapters || []) {
        for (const l of ch.lessons || []) {
          if (l && typeof l.lesson_id === 'number') lessonIds.push(l.lesson_id);
        }
      }
    }

    const checkpointMap = new Map<number, any>();
    if (lessonIds.length) {
      const rows: Array<any> = await this.courseRepository.query(
        `SELECT lesson_id, checkpoint_id, checkpoint_score, checkpoint_type, checkpoint_questions, checkpoint_option, checkpoint_answer, checkpoint_explanation, created_at, updated_at FROM quizs_checkpoint WHERE lesson_id = ANY($1)`,
        [lessonIds],
      );
      rows.forEach((row) => checkpointMap.set(Number(row.lesson_id), row));
    }

    const finalLevels: LevelStructureDto[] = sortedLevels
      .map((level) => {
        const chapters: ChapterStructureDto[] = (level.level_chapters || [])
          .sort((a, b) => a.chapter_orderIndex - b.chapter_orderIndex)
          .map((chapter) => {
            const lessons: LessonStructureDto[] = (chapter.lessons || [])
              .filter((lesson) => {
                const isPublished =
                  this.resolveLessonStructurePublishedState(lesson);
                return includeUnpublishedLessons || isPublished;
              })
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((lesson) => {
                const isPublished =
                  this.resolveLessonStructurePublishedState(lesson);
                const dto: LessonStructureDto = {
                  lesson_id: lesson.lesson_id,
                  lesson_title: lesson.lesson_title,
                  lesson_type: lesson.lesson_type,
                  lesson_description: lesson.lesson_description ?? undefined,
                  orderIndex: lesson.orderIndex,
                  isPublished,
                };

                if (lesson.lesson_type === LessonType.CHECKPOINT) {
                  const checkpoint = checkpointMap.get(lesson.lesson_id);
                  if (checkpoint) {
                    dto.checkpoint = checkpoint;
                  }
                }

                return dto;
              });

            // Admin view: แสดง chapter ว่างด้วย | Student view: ซ่อน chapter ที่ไม่มี lesson
            if (!lessons.length && !includeUnpublishedLessons) {
              return null;
            }

            return {
              chapter_id: chapter.chapter_id,
              chapter_title: chapter.chapter_title,
              orderIndex: chapter.chapter_orderIndex,
              isPublished: chapter.isPublished ?? true,
              lessons,
            } as ChapterStructureDto;
          })
          .filter(
            (chapter): chapter is ChapterStructureDto => chapter !== null,
          );

        // Admin view: แสดง level ว่างด้วย | Student view: ซ่อน level ที่ไม่มี chapter
        if (!chapters.length && !includeUnpublishedLessons) {
          return null;
        }

        return {
          level_id: level.level_id,
          level_title: level.level_title,
          orderIndex: level.level_orderIndex,
          chapters,
        } as LevelStructureDto;
      })
      .filter((level): level is LevelStructureDto => level !== null);

    return {
      course_id: course.course_id,
      course_title: course.course_title,
      course_description: course.course_description,
      isPublished: course.isPublished,
      course_tags: course.course_tags ?? undefined,
      course_levels: finalLevels,
    };
  }

  private getListCacheKey(params?: {
    isPublished?: boolean;
    course_ownerId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): string {
    const normalized = {
      isPublished: params?.isPublished,
      course_ownerId: params?.course_ownerId,
      search: params?.search?.trim().toLowerCase() || undefined,
      limit: params?.limit,
      offset: params?.offset,
    };

    return `course:list:${JSON.stringify(normalized)}`;
  }

  async invalidateCourseCaches(courseId: number): Promise<void> {
    if (!this.redisCacheService) {
      return;
    }

    await Promise.all([
      this.redisCacheService.deleteByPrefix('course:list:'),
      this.redisCacheService.del([
        `course:detail:${courseId}`,
        `course:structure:student:${courseId}`,
        `course:structure:admin:${courseId}`,
      ]),
      this.redisCacheService.deleteByPrefix('learner-home:recommendations:'),
    ]);
  }

  // แปลง Entity เป็น DTO สำหรับการตอบกลับ API
  private toResponseDto(course: Course): CourseResponseDto {
    return {
      course_id: course.course_id,
      course_ownerId: course.course_ownerId,
      course_title: course.course_title,
      course_description: course.course_description,
      course_tags: course.course_tags ?? undefined,
      course_imageUrl: course.course_imageUrl ?? undefined,
      course_totalChapter: course.course_totalChapter ?? 0,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  private resolveLessonStructurePublishedState(
    lesson?: {
      lesson_type?: LessonType;
      lesson_videoUrl?: string | null;
      isPublished?: boolean;
    } | null,
  ): boolean {
    if (!lesson) {
      return false;
    }

    if (lesson.lesson_type === LessonType.VIDEO) {
      return Boolean(lesson.lesson_videoUrl?.trim());
    }

    return lesson.isPublished === true;
  }
}
