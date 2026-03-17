import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from './entities/level.entity';
import { Course } from '../courses/entities/course.entity';
import { CreateLevelDto, UpdateLevelDto, LevelResponseDto } from './dto';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class LevelsService {
  constructor(
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly coursesService: CoursesService,
  ) {}

  async create(createLevelDto: CreateLevelDto): Promise<LevelResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { course_id: createLevelDto.course_id },
    });

    if (!course) {
      throw new NotFoundException(
        `Course with ID ${createLevelDto.course_id} not found`,
      );
    }

    // ถ้าไม่ได้ระบุ orderIndex มา ให้กำหนดค่า orderIndex เป็นค่าที่มากที่สุดในคอร์สนี้ + 1 เพื่อให้ระดับใหม่อยู่ท้ายสุด
    let orderIndex = createLevelDto.level_orderIndex;
    if (orderIndex === undefined) {
      const maxOrderResult = await this.levelRepository
        .createQueryBuilder('level')
        .where('level.course_id = :course_id', {
          course_id: createLevelDto.course_id,
        })
        .select('MAX(level.level_orderIndex)', 'maxOrder')
        .getRawOne();
      orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;
    }

    const level = this.levelRepository.create({
      level_title: createLevelDto.level_title,
      course_id: createLevelDto.course_id,
      level_orderIndex: orderIndex,
    });

    const saved = await this.levelRepository.save(level);
    await this.coursesService.invalidateCourseCaches(createLevelDto.course_id);
    return this.toResponseDto(saved);
  }

  async findByCourse(courseId: number): Promise<LevelResponseDto[]> {
    const levels = await this.levelRepository.find({
      where: { course_id: courseId },
      order: { level_orderIndex: 'ASC' },
    });

    return levels.map((l) => this.toResponseDto(l));
  }

  async findAll(): Promise<LevelResponseDto[]> {
    const levels = await this.levelRepository.find({
      order: { level_orderIndex: 'ASC' },
    });

    return levels.map((l) => this.toResponseDto(l));
  }

  async findOne(id: number): Promise<LevelResponseDto> {
    const level = await this.levelRepository.findOne({
      where: { level_id: id },
    });

    if (!level) {
      throw new NotFoundException(`Level with ID ${id} not found`);
    }

    return this.toResponseDto(level);
  }

  async update(
    id: number,
    updateLevelDto: UpdateLevelDto,
  ): Promise<LevelResponseDto> {
    const level = await this.levelRepository.findOne({
      where: { level_id: id },
    });

    if (!level) {
      throw new NotFoundException(`Level with ID ${id} not found`);
    }

    if (updateLevelDto.level_title !== undefined) {
      level.level_title = updateLevelDto.level_title;
    }

    if (updateLevelDto.level_orderIndex !== undefined) {
      level.level_orderIndex = updateLevelDto.level_orderIndex;
    }

    const saved = await this.levelRepository.save(level);
    await this.coursesService.invalidateCourseCaches(level.course_id);
    return this.toResponseDto(saved);
  }

  async remove(id: number): Promise<{ message: string }> {
    const level = await this.levelRepository.findOne({
      where: { level_id: id },
    });

    if (!level) {
      throw new NotFoundException(`Level with ID ${id} not found`);
    }

    await this.levelRepository.remove(level);
    await this.coursesService.invalidateCourseCaches(level.course_id);
    return { message: `Level with ID ${id} deleted successfully` };
  }

  async reorder(
    courseId: number,
    levelIds: number[],
  ): Promise<LevelResponseDto[]> {
    const levels = await this.levelRepository.find({
      where: { course_id: courseId },
    });

    // ถ้าไม่มีระดับในคอร์สนี้เลย จะคืน array ว่างกลับไปโดยไม่ตรวจ levelIds ที่ส่งมา
    if (levels.length === 0) {
      return [];
    }

    if (!Array.isArray(levelIds) || levelIds.length === 0) {
      throw new BadRequestException('level_ids must be a non-empty array');
    }

    if (levelIds.length !== levels.length) {
      throw new BadRequestException(
        `level_ids must include all levels in the course (expected ${levels.length}, got ${levelIds.length})`,
      );
    }

    const levelMap = new Map(levels.map((l) => [l.level_id, l]));

    // ตรวจสอบว่า levelIds ที่ส่งมาทุกตัวมีอยู่ในคอร์สนี้จริงๆ ถ้าไม่ใช่จะโยน error ออกมา
    for (const id of levelIds) {
      if (!levelMap.has(id)) {
        throw new BadRequestException(
          `Level ID ${id} does not belong to course ${courseId}`,
        );
      }
    }

    // ตรวจสอบว่า levelIds ที่ส่งมาครบทุกระดับในคอร์สนี้จริงๆ
    const provided = new Set(levelIds);
    for (const level of levels) {
      if (!provided.has(level.level_id)) {
        throw new BadRequestException(
          `level_ids must include all levels in the course; missing ${level.level_id}`,
        );
      }
    }

    // อัปเดต orderIndex ของแต่ละระดับตามลำดับใน levelIds ที่ส่งมา
    for (let i = 0; i < levelIds.length; i++) {
      const level = levelMap.get(levelIds[i]);
      if (level) {
        level.level_orderIndex = i;
        await this.levelRepository.save(level);
      }
    }

    await this.coursesService.invalidateCourseCaches(courseId);
    return this.findByCourse(courseId);
  }

  // แปลง Level entity เป็น LevelResponseDto
  private toResponseDto(level: Level): LevelResponseDto {
    return {
      level_id: level.level_id,
      level_title: level.level_title,
      level_orderIndex: level.level_orderIndex,
      course_id: level.course_id,
    };
  }
}
