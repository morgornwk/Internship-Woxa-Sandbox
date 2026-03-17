import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('admin_invitations')
@Index(['userId', 'isUsed'])
@Index(['expiresAt'])
export class AdminInvitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // ผู้ที่เชิญ admin คนนี้ (userId ของ admin ที่ส่งคำเชิญ)
  @Column({ name: 'invited_by_user_id', type: 'uuid' })
  invitedByUserId: string;

  // วันหมดอายุของคำเชิญ
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  // สถานะการใช้งาน token (ใช้ได้ครั้งเดียว)
  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  // วันที่สร้าง invitation
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  // ความสัมพันธ์กับ user ที่ถูกเชิญ
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
