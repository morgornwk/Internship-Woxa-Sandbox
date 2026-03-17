import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateChapterDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  chapter_title?: string;

  @IsString()
  @IsOptional()
  chapter_name?: string;

  @ApiPropertyOptional({
    description: 'Order index within the level',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  chapter_orderIndex?: number;
}
