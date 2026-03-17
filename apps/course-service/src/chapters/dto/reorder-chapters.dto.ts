import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ReorderChaptersDto {
  @ApiProperty({ example: 12, description: 'Level ID' })
  @IsInt()
  @Min(1)
  level_id: number;

  @ApiProperty({
    description:
      'Chapter IDs (chapter_id) in the desired order. This is NOT orderIndex values.',
    isArray: true,
    type: Number,
    example: [15, 16, 17, 18],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  chapter_ids: number[];
}
