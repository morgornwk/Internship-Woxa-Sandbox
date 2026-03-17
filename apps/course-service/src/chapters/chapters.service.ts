import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from './entities/chapter.entity';
import { Level } from '../levels/entities/level.entity';
import { CreateChapterDto, UpdateChapterDto, ChapterResponseDto } from './dto';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    private readonly coursesService: CoursesService,
  ) {}

  // Create a new chapter
  async create(
    createChapterDto: CreateChapterDto,
  ): Promise<ChapterResponseDto> {
    const level = await this.levelRepository.findOne({
      where: { level_id: createChapterDto.level_id },
    });

    if (!level) {
      throw new NotFoundException(
        `Level with ID ${createChapterDto.level_id} not found`,
      );
    }

    // ถ้าไม่ได้ระบุ orderIndex มา ให้กำหนดค่า orderIndex เป็นค่าที่มากที่สุดในระดับนั้น + 1 เพื่อให้บทใหม่อยู่ท้ายสุด
    let orderIndex = createChapterDto.chapter_orderIndex;
    if (orderIndex === undefined) {
      const maxOrderResult = await this.chapterRepository
        .createQueryBuilder('chapter')
        .where('chapter.level_id = :levelId', {
          levelId: createChapterDto.level_id,
        })
        .select('MAX(chapter.order_index)', 'maxOrder') // column ในฐานข้อมูลชื่อ order_index
        .getRawOne();

      // ถ้าไม่มีบทใดในระดับนี้เลย ให้เริ่มต้น orderIndex ที่ 0
      const maxOrder =
        maxOrderResult && maxOrderResult.maxOrder !== null
          ? Number(maxOrderResult.maxOrder)
          : -1;

      orderIndex = maxOrder + 1;
    }

    // สร้าง chapter ใหม่
    const chapter = this.chapterRepository.create({
      chapter_title: createChapterDto.chapter_title,
      chapter_name: createChapterDto.chapter_name,
      levelId: createChapterDto.level_id,
      chapter_orderIndex: orderIndex,
    });

    const saved = await this.chapterRepository.save(chapter);
    await this.coursesService.invalidateCourseCaches(level.course_id);
    return this.toResponseDto(saved);
  }

  // ค้นหาบททั้งหมดในระดับที่ระบุ
  async findByLevel(levelId: number): Promise<ChapterResponseDto[]> {
    return this.findByLevelInternal(levelId, { onlyPublished: false });
  }

  async findByLevelStudent(levelId: number): Promise<ChapterResponseDto[]> {
    return this.findByLevelInternal(levelId, { onlyPublished: true });
  }

  // ค้นหาบททั้งหมด
  async findAll(): Promise<ChapterResponseDto[]> {
    return this.findAllInternal({ onlyPublished: false });
  }

  async findAllStudent(): Promise<ChapterResponseDto[]> {
    return this.findAllInternal({ onlyPublished: true });
  }

  // ค้นหาบทโดยใช้ ID
  async findOne(id: number): Promise<ChapterResponseDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: id },
    });
    if (!chapter)
      throw new NotFoundException(`Chapter with ID ${id} not found`);

    return this.toResponseDto(chapter);
  }

  async findOneStudent(id: number): Promise<ChapterResponseDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: id },
    });
    if (!chapter)
      throw new NotFoundException(`Chapter with ID ${id} not found`);

    if (!chapter.isPublished)
      throw new NotFoundException(`Chapter with ID ${id} not found`);

    return this.toResponseDto(chapter);
  }

  // Update chapter by ID
  async update(
    id: number,
    updateChapterDto: UpdateChapterDto,
  ): Promise<ChapterResponseDto> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: id },
    });

    // ตรวจสอบว่าบทที่ต้องการอัปเดตมีจริงมั้ย
    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${id} not found`);
    }

    // Update fileds
    if (updateChapterDto.chapter_title !== undefined) {
      chapter.chapter_title = updateChapterDto.chapter_title;
    }

    if (updateChapterDto.chapter_name !== undefined) {
      chapter.chapter_name = updateChapterDto.chapter_name;
    }

    if (updateChapterDto.chapter_orderIndex !== undefined) {
      chapter.chapter_orderIndex = updateChapterDto.chapter_orderIndex;
    }

    const saved = await this.chapterRepository.save(chapter);
    // ล้าง cache โครงสร้างคอร์ส
    const level = await this.levelRepository.findOne({
      where: { level_id: chapter.levelId },
    });
    if (level) {
      await this.coursesService.invalidateCourseCaches(level.course_id);
    }
    return this.toResponseDto(saved);
  }

  // Delete chapter by ID
  async remove(id: number): Promise<{ message: string }> {
    const chapter = await this.chapterRepository.findOne({
      where: { chapter_id: id },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${id} not found`);
    }

    const levelId = chapter.levelId;
    await this.chapterRepository.remove(chapter);
    // ล้าง cache โครงสร้างคอร์ส
    const level = await this.levelRepository.findOne({
      where: { level_id: levelId },
    });
    if (level) {
      await this.coursesService.invalidateCourseCaches(level.course_id);
    }
    return { message: `Chapter with ID ${id} deleted successfully` };
  }

  // จัดลำดับบทภายในระดับ
  async reorder(
    levelId: number,
    chapterIds: number[],
  ): Promise<ChapterResponseDto[]> {
    const chapters = await this.chapterRepository.find({
      where: { levelId },
    });

    // ถ้าไม่มีบทในระดับนี้เลย ให้คืนค่าเป็น array ว่างแทน
    if (chapters.length === 0) {
      return [];
    }

    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      throw new BadRequestException('chapter_ids is required');
    }

    if (chapterIds.length !== chapters.length) {
      throw new BadRequestException(
        `chapter_ids must include all chapters in the level (expected ${chapters.length}, got ${chapterIds.length})`,
      );
    }

    // สร้าง map ของ chapter_id ไปยัง chapter entity เพื่อให้ค้นหาได้เร็วขึ้น
    const chapterMap = new Map(chapters.map((c) => [c.chapter_id, c]));

    for (const id of chapterIds) {
      if (!chapterMap.has(id)) {
        throw new BadRequestException(
          `Chapter ID ${id} does not belong to level ${levelId}`,
        );
      }
    }

    // ตรวจสอบว่า chapterIds ที่ให้มามีครบทุกบทในระดับนี้จริงมั้ย
    const provided = new Set(chapterIds);
    for (const chapter of chapters) {
      if (!provided.has(chapter.chapter_id)) {
        throw new BadRequestException(
          `chapter_ids must include all chapters in the level; missing ${chapter.chapter_id}`,
        );
      }
    }

    // อัปเดต orderIndex ของแต่ละบทตามลำดับใน chapterIds
    for (let i = 0; i < chapterIds.length; i++) {
      const chapter = chapterMap.get(chapterIds[i]);
      if (chapter) {
        chapter.chapter_orderIndex = i;
        await this.chapterRepository.save(chapter);
      }
    }

    // ล้าง cache โครงสร้างคอร์ส
    const level = await this.levelRepository.findOne({
      where: { level_id: levelId },
    });
    if (level) {
      await this.coursesService.invalidateCourseCaches(level.course_id);
    }

    return this.findByLevel(levelId);
  }

  // Chapter entity to ChapterResponseDto
  private toResponseDto(chapter: Chapter): ChapterResponseDto {
    return {
      chapter_id: chapter.chapter_id,
      chapter_title: chapter.chapter_title,
      chapter_name: chapter.chapter_name,
      isPublished: chapter.isPublished,
      chapter_orderIndex: chapter.chapter_orderIndex,
      level_id: chapter.levelId,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    };
  }

  private async findByLevelInternal(
    levelId: number,
    opts: { onlyPublished: boolean },
  ): Promise<ChapterResponseDto[]> {
    const where: any = { levelId };
    if (opts.onlyPublished) where.isPublished = true;

    const chapters = await this.chapterRepository.find({
      where,
      order: { chapter_orderIndex: 'ASC' },
    });

    return chapters.map((c) => this.toResponseDto(c));
  }

  private async findAllInternal(opts: {
    onlyPublished: boolean;
  }): Promise<ChapterResponseDto[]> {
    const where: any = {};
    if (opts.onlyPublished) where.isPublished = true;

    const chapters = await this.chapterRepository.find({
      where,
      order: { chapter_orderIndex: 'ASC' },
    });

    return chapters.map((c) => this.toResponseDto(c));
  }
}
