import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Level } from '../../levels/entities/level.entity';
import { Lesson } from '../../lessons/entities/lesson.entity';

@Entity('chapters')
@Index('idx_chapters_level_id', ['levelId'])
export class Chapter {
  @PrimaryGeneratedColumn()
  chapter_id: number;

  @Column({ type: 'varchar', length: 150 })
  chapter_title: string;

  @Column({ name: 'chapter_name', type: 'varchar', length: 100 })
  chapter_name: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  chapter_orderIndex: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @ManyToOne(() => Level, (level) => level.level_chapters, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'level_id', referencedColumnName: 'level_id' })
  level: Level;

  @Column({ name: 'level_id', type: 'int' })
  levelId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Lesson, (lesson) => lesson.chapter, { cascade: true })
  lessons: Lesson[];
}
