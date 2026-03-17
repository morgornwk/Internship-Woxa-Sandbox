import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ReorderLessonsDto {
  @ApiProperty({ example: 15, description: 'Chapter ID' })
  @IsInt()
  @Min(1)
  chapterId: number;

  @ApiProperty({
    description:
      'Lesson IDs (lesson_id) in the desired order. This is NOT orderIndex values.',
    isArray: true,
    type: Number,
    example: [9, 10, 11, 12],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  lessonIds: number[];
}
