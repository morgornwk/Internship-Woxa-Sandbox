import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';

@Entity('quizs_checkpoint')
export class QuizsCheckpoint {
  @PrimaryGeneratedColumn({ name: 'checkpoint_id' })
  checkpointId: number;

  @Column({ name: 'checkpoint_score', type: 'int', default: 5 })
  checkpointScore: number;

  @Column({
    name: 'checkpoint_type',
    type: 'enum',
    enum: ['multiple_choice', 'true_false'],
    default: 'multiple_choice',
  })
  checkpointType: string;

  @Column({ name: 'checkpoint_questions', type: 'text' })
  checkpointQuestions: string;

  @Column({ name: 'checkpoint_option', type: 'jsonb', nullable: true })
  checkpointOption: string[];

  @Column({ name: 'checkpoint_answer', type: 'jsonb' })
  checkpointAnswer: unknown;

  @Column({ name: 'checkpoint_explanation', type: 'text', nullable: true })
  checkpointExplanation?: string | null;

  @Column({ name: 'lesson_id', type: 'integer' })
  lessonId: number;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', referencedColumnName: 'lesson_id' })
  lesson: Lesson;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
