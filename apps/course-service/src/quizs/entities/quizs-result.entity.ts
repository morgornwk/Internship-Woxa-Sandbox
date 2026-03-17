import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';
import { QuizsCheckpoint } from './checkpoint.entity';

export enum QuizsResultType {
  QUIZ = 'QUIZ',
  CHECKPOINT = 'CHECKPOINT',
}

export enum QuizsStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

@Entity('quizs_results')
@Index(['userId', 'lessonId'])
@Index(['userId', 'type', 'checkpointId'])
export class QuizsResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'text' })
  userId: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: QuizsResultType,
    default: QuizsResultType.QUIZ,
  })
  type: QuizsResultType;

  @Column({ name: 'lesson_id', type: 'integer' })
  lessonId: number;

  // ใช้เมื่อ type = QUIZ
  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', referencedColumnName: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'checkpoint_id', type: 'integer', nullable: true })
  checkpointId: number | null;

  // ใช้เมื่อ type = CHECKPOINT
  @ManyToOne(() => QuizsCheckpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checkpoint_id', referencedColumnName: 'checkpointId' })
  checkpoint: QuizsCheckpoint | null;

  @Column({ name: 'user_answer', type: 'jsonb', nullable: true })
  userAnswer: unknown;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @Column({
    type: 'enum',
    enum: QuizsStatus,
    default: QuizsStatus.PENDING,
  })
  status: QuizsStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
