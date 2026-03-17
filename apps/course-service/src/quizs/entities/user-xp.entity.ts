import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_xp')
@Index('idx_user_xp_user_id', ['userId'])
@Index('uq_user_xp_user_chapter', ['userId', 'chapterId'], { unique: true })
export class UserXp {
  @PrimaryGeneratedColumn({ name: 'user_xp_id', type: 'int' })
  userXpId: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'chapter_id', type: 'int' })
  chapterId: number;

  @Column({ name: 'xp_earned', type: 'int', default: 0 })
  xpEarned: number;

  @Column({ name: 'xp_total', type: 'int', default: 0 })
  xpTotal: number;

  @Column({
    name: 'checkpoint_status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  checkpointStatus: 'PENDING' | 'COMPLETED' | 'SKIPPED';

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
