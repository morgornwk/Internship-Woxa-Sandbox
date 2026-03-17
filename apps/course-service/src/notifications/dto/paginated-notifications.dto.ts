import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

export class PaginatedNotificationsDto {
  @ApiProperty({
    type: [NotificationResponseDto],
    description: 'Array of notifications for the current page',
  })
  data: NotificationResponseDto[];

  @ApiProperty({
    example: 25,
    description: 'Total number of notifications for the user',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number (1-based)',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;
}
