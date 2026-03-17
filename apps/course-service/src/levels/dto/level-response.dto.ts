import { ApiProperty } from '@nestjs/swagger';

export class LevelResponseDto {
  @ApiProperty({ description: 'Level ID', example: 1 })
  level_id: number;

  @ApiProperty({ description: 'Level title', example: 'Beginner Level' })
  level_title: string;

  @ApiProperty({ description: 'Order index within the course', example: 0 })
  level_orderIndex: number;

  @ApiProperty({ description: 'Course ID this level belongs to', example: 1 })
  course_id: number;
}
