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

export enum LessonProgressStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

@Entity('progress')
@Index('idx_progress_user_id', ['userId'])
@Index('idx_progress_lesson_id', ['lessonId'])
@Index('uq_progress_user_lesson', ['userId', 'lessonId'], { unique: true })
export class LessonProgress {
  @PrimaryGeneratedColumn({ name: 'lesson_progress_id', type: 'int' })
  lessonProgressId: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'lesson_id', type: 'int' })
  lessonId: number;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', referencedColumnName: 'lesson_id' })
  lesson: Lesson;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: LessonProgressStatus.IN_PROGRESS,
  })
  status: LessonProgressStatus;

  @Column({
    name: 'progress_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  progressPercent: number;

  @Column({ name: 'map_lesson_id', type: 'int', nullable: true })
  mapLessonId?: number | null;

  // เวลาที่ผู้เรียนดูหรือเล่นไปถึง ณ ตอนล่าสุด (หน่วยวินาที)
  @Column({ name: 'position_seconds', type: 'int', nullable: true })
  positionSeconds?: number | null;

  // ความยาวทั้งหมดของสื่อบทเรียน (หน่วยวินาที)
  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds?: number | null;

  @Column({ name: 'last_viewed_at', type: 'timestamp', nullable: true })
  lastViewedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
