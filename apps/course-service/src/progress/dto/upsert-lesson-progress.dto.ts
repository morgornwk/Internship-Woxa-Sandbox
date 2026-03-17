import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { LessonProgressStatus } from '../entities/progress.entity';

export class UpsertLessonProgressDto {
  @ApiPropertyOptional({ enum: LessonProgressStatus })
  @IsOptional()
  @IsEnum(LessonProgressStatus)
  status?: LessonProgressStatus;

  @ApiPropertyOptional({ description: '0..100' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj }) => value ?? obj.progress_Percent)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @ApiPropertyOptional({ description: 'Current playback position (seconds)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj }) => value ?? obj.position_Seconds)
  @IsNumber()
  @Min(0)
  positionSeconds?: number;

  @ApiPropertyOptional({ description: 'Total duration (seconds)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj }) => value ?? obj.duration_Seconds)
  @IsNumber()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({
    description: 'If true, mark lesson completed (sets percent=100)',
  })
  @IsOptional()
  @IsBoolean()
  markCompleted?: boolean;
}
