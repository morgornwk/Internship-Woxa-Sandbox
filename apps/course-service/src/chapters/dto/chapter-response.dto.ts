import { ApiProperty } from '@nestjs/swagger';

export class ChapterResponseDto {
  @ApiProperty({ description: 'Chapter ID', example: 1 })
  chapter_id: number;

  @ApiProperty({ description: 'Chapter title', example: 'Getting Started' })
  chapter_title: string;

  @ApiProperty({ description: 'Chapter name', example: 'getting-started' })
  chapter_name: string;

  @ApiProperty({
    description:
      'Whether this chapter has at least one published lesson (visible to students)',
    example: true,
  })
  isPublished: boolean;

  @ApiProperty({ description: 'Order index within level', example: 0 })
  chapter_orderIndex: number;

  @ApiProperty({ description: 'Level ID this chapter belongs to', example: 1 })
  level_id: number;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
