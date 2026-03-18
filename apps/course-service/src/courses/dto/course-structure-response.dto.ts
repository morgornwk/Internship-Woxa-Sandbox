import { ApiProperty } from '@nestjs/swagger';

// DTO สำหรับโครงสร้างหลักสูตรที่มีระดับ บท และบทเรียน
export class LessonStructureDto {
  @ApiProperty({ description: 'Lesson ID' })
  lesson_id: number;

  @ApiProperty({ description: 'Lesson title' })
  lesson_title: string;

  @ApiProperty({ description: 'Lesson type' })
  lesson_type: string;

  @ApiProperty({ description: 'Lesson description', required: false })
  lesson_description?: string;

  @ApiProperty({ description: 'Order index in chapter' })
  orderIndex: number;

  @ApiProperty({
    description: 'Whether the lesson is published',
    required: false,
  })
  isPublished?: boolean;

}

// DTO สำหรับโครงสร้างบทที่มีบทเรียน
export class ChapterStructureDto {
  @ApiProperty({ description: 'Chapter ID' })
  chapter_id: number;

  @ApiProperty({ description: 'Chapter title' })
  chapter_title: string;

  @ApiProperty({ description: 'Order index in level' })
  orderIndex: number;

  @ApiProperty({
    description: 'Whether this chapter has at least one published lesson',
    required: false,
  })
  isPublished?: boolean;

  @ApiProperty({
    description: 'Lessons in this chapter',
    type: [LessonStructureDto],
  })
  lessons: LessonStructureDto[];
}

// DTO สำหรับโครงสร้างระดับที่มีบท
export class LevelStructureDto {
  @ApiProperty({ description: 'Level ID' })
  level_id: number;

  @ApiProperty({ description: 'Level title' })
  level_title: string;

  @ApiProperty({ description: 'Order index in course' })
  orderIndex: number;

  @ApiProperty({
    description: 'Chapters in this level',
    type: [ChapterStructureDto],
  })
  chapters: ChapterStructureDto[];
}

// DTO สำหรับโครงสร้างหลักสูตรที่มีระดับ บท และบทเรียน
export class CourseStructureResponseDto {
  @ApiProperty({ description: 'Course ID' })
  course_id: number;

  @ApiProperty({ description: 'Course title' })
  course_title: string;

  @ApiProperty({ description: 'Course description', required: false })
  course_description?: string;

  @ApiProperty({ description: 'Course tags', required: false, type: [String] })
  course_tags?: string[];

  @ApiProperty({ description: 'Is the course published' })
  isPublished: boolean;

  @ApiProperty({
    description: 'Levels in this course',
    type: [LevelStructureDto],
  })
  course_levels: LevelStructureDto[];
}
