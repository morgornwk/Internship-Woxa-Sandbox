import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseResponseDto {
  @ApiProperty({ description: 'Course ID', example: 1 })
  course_id: number;

  @ApiProperty({ description: 'Owner user ID', example: 1 })
  course_ownerId: number;

  @ApiProperty({
    description: 'Course title',
    example: 'Introduction to TypeScript',
  })
  course_title: string;

  @ApiPropertyOptional({ description: 'Course description' })
  course_description?: string;

  @ApiPropertyOptional({ description: 'Cover image URL (CloudFront CDN)' })
  course_imageUrl?: string;

  @ApiPropertyOptional({ description: 'Course tags', type: [String] })
  course_tags?: string[];

  @ApiProperty({ description: 'Total chapters in this course', example: 12 })
  course_totalChapter: number;

  @ApiProperty({ description: 'Is the course published', example: false })
  isPublished: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
