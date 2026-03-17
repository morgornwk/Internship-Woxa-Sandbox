import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import { UpdateArticleDto } from './dto';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) {}

  // สร้างบทความใหม่
  async create(dto: CreateArticleDto): Promise<ArticleResponseDto> {
    const lesson = await this.lessonRepo.findOne({
      where: { lesson_id: dto.lesson_id },
    });
    if (!lesson) {
      throw new NotFoundException(`lesson with ID ${dto.lesson_id} not found`);
    }

    if (lesson.lesson_type !== LessonType.ARTICLE) {
      throw new BadRequestException('lesson is not type ARTICLE');
    }

    const content = Array.isArray(dto.article_content)
      ? dto.article_content
      : [];

    // ถ้า article_content มีค่า ให้ตรวจสอบและกำหนดค่า order ให้กับแต่ละ block ถ้าไม่มีการกำหนด order มาเลย
    content.forEach((c, i) => {
      if (c.order == null) c.order = i + 1;
    });

    const article = this.articleRepo.create({
      lesson: { lesson_id: dto.lesson_id } as any,
      article_content: content,
    });

    const saved = await this.articleRepo.save(article);

    return this.toResponseDto(saved);
  }

  // ค้นหาบทความตาม ID
  async findOne(id: number): Promise<ArticleResponseDto> {
    const article = await this.articleRepo.findOne({
      where: { article_id: id },
    });

    if (!article) {
      throw new NotFoundException(`article with ID ${id} not found`);
    }

    return this.toResponseDto(article);
  }

  // ค้นหาบทความทั้งหมด โดยสามารถใช้ limit และ offset ในการแบ่งหน้าได้
  async findAll(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ArticleResponseDto[]> {
    const limit =
      params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 50;
    const offset = params?.offset && params.offset >= 0 ? params.offset : 0;
    const rows = await this.articleRepo.find({
      take: limit,
      skip: offset,
      order: { updatedAt: 'DESC' },
    });

    return rows.map((r) => this.toResponseDto(r));
  }

  async update(id: number, dto: UpdateArticleDto): Promise<ArticleResponseDto> {
    const article = await this.articleRepo.findOne({
      where: { article_id: id },
    });

    if (!article) {
      throw new NotFoundException(`article with ID ${id} not found`);
    }

    Object.assign(article, dto);

    const updated = await this.articleRepo.save(article);
    return this.toResponseDto(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const article = await this.articleRepo.findOne({
      where: { article_id: id },
    });

    if (!article) {
      throw new NotFoundException(`article with ID ${id} not found`);
    }

    await this.articleRepo.remove(article);
    return { message: 'article deleted successfully' };
  }

  async findByLesson(lessonId: number): Promise<ArticleResponseDto[]> {
    const lesson = await this.lessonRepo.findOne({
      where: { lesson_id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`lesson with ID ${lessonId} not found`);
    }

    // ถ้า lesson ไม่ใช่ประเภท ARTICLE ให้คืนค่าเป็น array ว่างแทน
    if (lesson.lesson_type !== LessonType.ARTICLE) {
      return [];
    }
    const articles = await this.articleRepo.find({
      where: { lesson: { lesson_id: lessonId } },
    });

    return articles.map((a) => this.toResponseDto(a));
  }

  // function แปลง Article entity เป็น ArticleResponseDto โดยดึง lesson_id จาก relation หรือ field ตรงๆ แล้วแต่กรณี
  private toResponseDto(article: Article): ArticleResponseDto {
    const lessonIdValue =
      typeof (article as any).lesson_id === 'number'
        ? (article as any).lesson_id
        : ((article as any).lesson?.lesson_id ?? null);

    return {
      article_id: article.article_id,
      lesson_id: lessonIdValue,
      article_content: article.article_content,
    };
  }
}
