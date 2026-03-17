import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Chapter } from '../../chapters/entities/chapter.entity';

@Entity('levels')
@Index('idx_levels_course_id', ['course_id'])
export class Level {
  @PrimaryGeneratedColumn()
  level_id: number;

  @Column()
  level_title: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  level_orderIndex: number;

  @ManyToOne(() => Course, (course) => course.course_levels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'course_id', referencedColumnName: 'course_id' })
  course: Course;

  @Column({ name: 'course_id', type: 'int' })
  course_id: number;

  @OneToMany(() => Chapter, (chapter) => chapter.level, { cascade: true })
  level_chapters: Chapter[];
}
