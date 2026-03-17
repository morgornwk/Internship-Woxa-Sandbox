import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { RewardRedemption } from './reward-redemption';

export enum RedemptionType {
  SPOT = 'SPOT',
  SELF_PICKUP = 'SELF_PICKUP',
  DELIVERY = 'DELIVERY',
  BOTH = 'BOTH',
}

@Entity('rewards')
@Index('idx_reward_active', ['is_active'])
@Index('idx_reward_period', ['redeem_start_date', 'redeem_end_date'])
@Index('idx_reward_points', ['required_points'])
@Index('idx_reward_active_period', [
  'is_active',
  'redeem_start_date',
  'redeem_end_date',
])
export class Reward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({ type: 'decimal', precision: 6, nullable: true })
  remain: number;

  @Column({ nullable: false })
  image_url: string;

  @Column({ type: 'decimal', precision: 6, nullable: false })
  required_points: number;

  @Column({ type: 'timestamp', nullable: false })
  redeem_start_date: Date;

  @Column({ type: 'timestamp', nullable: false })
  redeem_end_date: Date;

  // @Column({ nullable: true })
  // expire_after_days: number;

  @Column({ nullable: true })
  limit_per_user: number;

  @Column({ nullable: true })
  total_limit: number;

  // @Column({ nullable: true })
  // show_remaining_threshold: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  delete_at: Date;

  @OneToMany(() => RewardRedemption, (redemption) => redemption.reward)
  redemptions: RewardRedemption[];
}
