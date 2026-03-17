import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateLevelDto {
  @ApiPropertyOptional({
    description: 'Level title',
    example: 'Beginner Level',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  level_title?: string;

  @ApiPropertyOptional({
    description: 'Order index within the course',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  level_orderIndex?: number;
}
