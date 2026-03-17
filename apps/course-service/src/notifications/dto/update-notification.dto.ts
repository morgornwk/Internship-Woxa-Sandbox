import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    example: 'Updated: Course Completed! 🎉',
    description: 'Updated notification title',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example:
      'Congratulations! You successfully completed "Advanced TypeScript"',
    description: 'Updated notification message',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    example: 'warning',
    enum: ['info', 'success', 'warning', 'error'],
    description: 'Updated notification type',
  })
  @IsEnum(['info', 'success', 'warning', 'error'])
  @IsOptional()
  type?: 'info' | 'success' | 'warning' | 'error';

  @ApiPropertyOptional({
    example: {
      type: 'course_completed',
      courseTitle: 'Advanced TypeScript',
      courseId: 2,
      updated: true,
    },
    description: 'Updated notification metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
