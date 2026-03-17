import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({
    example: '8a06f4c0-7e22-4c32-9834-0847014d97cd',
    description: 'Unique identifier for the notification (UUID)',
  })
  id: string;

  @ApiProperty({ example: 'Course Completed! 🎉' })
  title: string;

  @ApiProperty({
    example: 'Congratulations! You completed "TypeScript Basics"',
  })
  message: string;

  @ApiProperty({
    example: 'success',
    enum: ['info', 'success', 'warning', 'error'],
    description: 'Notification type for styling and filtering',
  })
  type: 'info' | 'success' | 'warning' | 'error';

  @ApiProperty({
    example: '2026-02-18T10:30:00Z',
    nullable: true,
    description: 'When the notification was marked as read. null means unread.',
  })
  readAt: string | null;

  @ApiProperty({
    example: { type: 'course_completed', courseTitle: 'TypeScript Basics' },
    description: 'Additional notification metadata for specific actions',
  })
  metadata: Record<string, any>;

  @ApiProperty({
    example: '2026-02-18T10:30:00Z',
    description: 'When the notification was created',
  })
  createdAt: string;
}
