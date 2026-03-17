import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  IsArray,
} from 'class-validator';

export class UpdateCourseDto {
  @ApiPropertyOptional({
    description: 'Course title',
    example: 'Introduction to TypeScript',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  course_title?: string;

  @ApiPropertyOptional({
    description: 'Course description',
    example: 'Learn TypeScript from scratch',
  })
  @IsOptional()
  @IsString()
  course_description?: string;

  @ApiPropertyOptional({
    description: 'Cover image URL (CloudFront CDN)',
    example: 'https://cdn.skillacademy.com/images/abc123.jpg',
  })
  @IsOptional()
  @IsString()
  course_imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Is the course published',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Course tags',
    type: [String],
    example: ['programming', 'typescript'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  course_tags?: string[] | null;
}
