import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  IsArray,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({
    description: 'Course title',
    example: 'Introduction to TypeScript',
  })
  @IsString()
  @MaxLength(255)
  course_title: string;

  @ApiPropertyOptional({
    description: 'Course description',
    example: 'Learn TypeScript from scratch',
  })
  @IsOptional()
  @IsString()
  course_description?: string;

  @ApiPropertyOptional({ description: 'Owner user ID', example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  course_ownerId?: number;

  @ApiPropertyOptional({
    description: 'Cover image URL (CloudFront CDN)',
    example: 'https://cdn.skillacademy.com/images/abc123.jpg',
  })
  @IsOptional()
  @IsString()
  course_imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Course tags',
    type: [String],
    example: ['programming', 'typescript'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  course_tags?: string[];

  @ApiPropertyOptional({
    description: 'Is the course published',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
