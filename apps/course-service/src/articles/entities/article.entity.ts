import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  RelationId,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  article_id: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.lesson_articles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @RelationId((article: Article) => article.lesson)
  lesson_id: number;

  // เก็บ article content เป็น jsonb โดยมีค่าเป็น array
  @Column({ type: 'jsonb', default: () => "'[]'" })
  article_content: any[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
