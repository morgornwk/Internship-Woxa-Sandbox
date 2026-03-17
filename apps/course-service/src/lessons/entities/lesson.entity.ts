import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Chapter } from '../../chapters/entities/chapter.entity';
import { Article } from '../../articles/entities/article.entity';
import { Quizs } from '../../quizs/entities/quizs.entity';
import { QuizsCheckpoint } from '../../quizs/entities/checkpoint.entity';

export enum LessonType {
  ARTICLE = 'article',
  VIDEO = 'video',
  QUIZ = 'quiz',
  CHECKPOINT = 'checkpoint',
}

@Entity('lessons')
@Index('idx_lessons_chapter_id', ['chapter_id'])
export class Lesson {
  @PrimaryGeneratedColumn()
  lesson_id: number;

  @Column()
  lesson_title: string;

  @Column({ name: 'lesson_description', type: 'text', nullable: true })
  lesson_description?: string | null;

  @Column({
    type: 'enum',
    enum: LessonType,
    default: LessonType.ARTICLE,
  })
  lesson_type: LessonType;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @Column({
    name: 'lesson_image_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  lesson_ImageUrl?: string | null;

  @Column({
    name: 'lesson_video_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  lesson_videoUrl?: string | null;

  @ManyToOne(() => Chapter, (chapter) => chapter.lessons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chapter_id', referencedColumnName: 'chapter_id' })
  chapter: Chapter;
  @Column({ name: 'chapter_id', type: 'int' })
  chapter_id: number;

  // ความสัมพันธ์กับบทความ (ถ้า lesson_type เป็น ARTICLE)
  @OneToMany(() => Article, (a) => a.lesson, { cascade: true })
  lesson_articles: Article[];

  // ความสัมพันธ์กับ Quizs
  @OneToMany(() => Quizs, (quiz) => quiz.lesson, { cascade: true })
  lesson_quizs: Quizs[];

  // ความสัมพันธ์กับ QuizsCheckpoint
  @OneToMany(() => QuizsCheckpoint, (checkpoint) => checkpoint.lesson, {
    cascade: true,
  })
  lesson_checkpoints: QuizsCheckpoint[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
