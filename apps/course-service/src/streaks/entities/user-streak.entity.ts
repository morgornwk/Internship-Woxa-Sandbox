import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_streak')
@Index('uq_user_streak_user', ['userId'], { unique: true })
export class UserStreak {
  @PrimaryGeneratedColumn({ name: 'user_streak_id', type: 'int' })
  userStreakId: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak: number;

  @Column({ name: 'longest_streak', type: 'int', default: 0 })
  longestStreak: number;

  @Column({ name: 'last_completed_at', type: 'timestamp', nullable: true })
  lastCompletedAt: Date | null;

  @Column({ name: 'reward_shown_at', type: 'timestamp', nullable: true })
  rewardShownAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
