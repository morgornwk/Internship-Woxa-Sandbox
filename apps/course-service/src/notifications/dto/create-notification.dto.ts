import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'User ID to send notification to (optional for system notifications)',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    example: 'Course Completed! 🎉',
    description: 'Notification title',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Congratulations! You completed "TypeScript Basics"',
    description: 'Notification message',
  })
  @IsString()
  message: string;

  @ApiProperty({
    example: 'success',
    enum: ['info', 'success', 'warning', 'error'],
    description: 'Notification type for styling',
    default: 'info',
  })
  @IsEnum(['info', 'success', 'warning', 'error'])
  type: 'info' | 'success' | 'warning' | 'error' = 'info';

  @ApiPropertyOptional({
    example: {
      type: 'course_completed',
      courseTitle: 'TypeScript Basics',
      courseId: 1,
    },
    description: 'Additional notification metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
