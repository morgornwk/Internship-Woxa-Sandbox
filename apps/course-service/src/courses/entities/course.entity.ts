import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Level } from '../../levels/entities/level.entity';

@Entity('courses')
@Index('idx_courses_course_owner_id', ['course_ownerId'])
@Index('idx_courses_is_published', ['isPublished'])
export class Course {
  @PrimaryGeneratedColumn()
  course_id: number;

  @Column({ name: 'course_owner_id', type: 'int' })
  course_ownerId: number;

  @Column()
  course_title: string;

  @Column({ type: 'text', nullable: true })
  course_description?: string;

  @Column({
    name: 'course_image_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  course_imageUrl?: string | null;

  @Column({ name: 'course_tags', type: 'text', array: true, nullable: true })
  course_tags?: string[] | null;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'course_total_chapter', type: 'int', default: 0 })
  course_totalChapter: number;

  @OneToMany(() => Level, (level) => level.course, { cascade: true })
  course_levels: Level[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
