import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Reward } from './rewards.entity';
import { IsUUID } from 'class-validator';

@Entity('reward_redemptions')
@Index('idx_redemption_reward', ['reward'])
@Index('idx_redemption_redeemed_at', ['redeemed_at'])
export class RewardRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @IsUUID()
  @Column({ name: 'user_uuid', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Reward, (reward) => reward.redemptions, {
    onDelete: 'CASCADE',
  })
  reward: Reward;

  @Column({ type: 'decimal', precision: 6, scale: 0 })
  used_points: number;

  @Column({ type: 'timestamp', nullable: true })
  expire_at?: Date | null;

  @Column({ unique: true })
  redeem_token: string;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn()
  redeemed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  delete_at?: Date | null;
}
