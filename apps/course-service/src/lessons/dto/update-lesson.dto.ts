import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { LessonType } from '../entities/lesson.entity';

export class UpdateLessonDto {
  @ApiPropertyOptional({
    description: 'Lesson title',
    example: 'Introduction to Variables',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lesson_title?: string;

  @ApiPropertyOptional({
    description: 'Lesson description',
    example: 'Learn about variable types',
  })
  @IsOptional()
  @IsString()
  lesson_description?: string;

  @ApiPropertyOptional({
    description: 'Lesson type',
    enum: LessonType,
    example: LessonType.ARTICLE,
  })
  @IsOptional()
  @IsEnum(LessonType)
  lesson_type?: LessonType;

  @ApiPropertyOptional({
    description: 'Order index within the chapter',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    description: 'Cover image URL (CloudFront CDN)',
    example: 'https://cdn.skillacademy.com/images/abc123.jpg',
  })
  @IsOptional()
  @IsString()
  lesson_ImageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Main video URL (CloudFront CDN)',
    example: 'https://cdn.skillacademy.com/videos/abc123.mp4',
  })
  @IsOptional()
  @IsString()
  lesson_videoUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the lesson is published (visible to students)',
    example: false,
  })
  @IsOptional()
  isPublished?: boolean;
}
