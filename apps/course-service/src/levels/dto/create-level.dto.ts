import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLevelDto {
  @ApiProperty({ description: 'Level title', example: 'Beginner Level' })
  @IsString()
  @MaxLength(255)
  level_title: string;

  @ApiProperty({ description: 'Course ID this level belongs to', example: 1 })
  @IsNumber()
  @Min(1)
  course_id: number;

  @ApiPropertyOptional({
    description: 'Order index within the course',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  level_orderIndex?: number;
}
