import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ReorderLevelsDto {
  @ApiProperty({ example: 19, description: 'Course ID' })
  @IsInt()
  @Min(1)
  course_id: number;

  @ApiProperty({
    description:
      'Level IDs (level_id) in the desired order. This is NOT orderIndex values.',
    isArray: true,
    type: Number,
    example: [12, 8, 9, 10],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  level_ids: number[];
}
