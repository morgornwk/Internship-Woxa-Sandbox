import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LessonResponseDto {
  @ApiProperty({ description: 'Lesson ID', example: 1 })
  lesson_id: number;

  @ApiProperty({
    description: 'Lesson title',
    example: 'Introduction to Variables',
  })
  lesson_title: string;

  @ApiPropertyOptional({ description: 'Lesson description' })
  lesson_description?: string;

  @ApiProperty({ description: 'Lesson type', example: 'article' })
  lesson_type: string;

  @ApiProperty({ description: 'Order index within the chapter', example: 0 })
  orderIndex: number;

  @ApiProperty({
    description: 'Whether the lesson is published (visible to students)',
    example: true,
  })
  isPublished: boolean;

  @ApiProperty({ description: 'Chapter ID this lesson belongs to', example: 1 })
  chapter_id: number;

  @ApiPropertyOptional({ description: 'Cover image URL (CloudFront CDN)' })
  lesson_ImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Main video URL (CloudFront CDN)' })
  lesson_videoUrl?: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
