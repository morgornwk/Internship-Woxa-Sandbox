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

@Entity('quizs')
export class Quizs {
  @PrimaryGeneratedColumn({ name: 'quizs_id' })
  quizsId: number;

  @Column({
    name: 'quizs_type',
    type: 'enum',
    enum: ['multiple_choice', 'true_false'],
    default: 'multiple_choice',
  })
  quizsType: string;

  @Column({ name: 'quizs_questions', type: 'text' })
  quizsQuestions: string;

  @Column({ name: 'quizs_option', type: 'jsonb', nullable: true })
  quizsOption: string[];

  @Column({ name: 'quizs_answer', type: 'jsonb' })
  quizsAnswer: unknown;

  @Column({ name: 'quizs_explanation', type: 'text', nullable: true })
  quizsExplanation: string;

  @Column({ name: 'lesson_id', unique: true })
  lessonId: number;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', referencedColumnName: 'lesson_id' })
  lesson: Lesson;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
