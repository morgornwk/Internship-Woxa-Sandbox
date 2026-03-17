import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('announcements')
@Index('idx_announcements_active_priority', ['activeStatus', 'priority'])
@Index('idx_announcements_date_range', ['startDate', 'endDate'])
export class Announcement {
  @PrimaryGeneratedColumn()
  announcement_id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'deep_link', type: 'varchar', length: 2048, nullable: true })
  deepLink?: string | null;

  @Column({ name: 'active_status', type: 'boolean', default: true })
  activeStatus: boolean;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate?: Date | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
