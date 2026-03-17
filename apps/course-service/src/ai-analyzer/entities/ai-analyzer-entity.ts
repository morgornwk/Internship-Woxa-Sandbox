import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';

@Entity('ai_analyzer_generation')
@Index('idx_ai_quiz_lesson_id', ['lessonId'])
export class AiQuizGeneration {
  @PrimaryGeneratedColumn({ name: 'ai_quiz_id' })
  ai_quiz_id: number;

  @Column({ name: 'lesson_id' })
  lessonId: number;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', referencedColumnName: 'lesson_id' })
  lesson: Lesson;

  // เก็บ prompt ที่ใช้ generate
  @Column({ name: 'prompt_used', type: 'text' })
  prompt_used: string;

  // raw response จาก OpenAI
  @Column({ name: 'ai_response', type: 'jsonb' })
  ai_response: any;

  // model ที่ใช้ เช่น gpt-4o-mini
  @Column({ name: 'model_name', type: 'varchar', length: 100 })
  model_name: string;

  // สถานะ moderation
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
