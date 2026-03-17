import { ApiProperty } from '@nestjs/swagger';

export class CourseProgressSummaryDto {
  @ApiProperty()
  courseId: number;

  @ApiProperty()
  totalLessons: number;

  @ApiProperty()
  completedLessons: number;

  @ApiProperty({ description: '0..100' })
  percent: number;

  @ApiProperty({ required: false, nullable: true })
  resumeLessonId?: number | null;
}
