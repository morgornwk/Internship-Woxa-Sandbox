import {
  Controller,
  DefaultValuePipe,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth';

import { CurrentUserId } from './decorators/current-user-id.decorator';
import { NotificationsService } from './notifications.service';
import { PaginatedNotificationsDto } from './dto/paginated-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications (paginated)' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getNotifications(
    @CurrentUserId() userId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<PaginatedNotificationsDto> {
    const {
      notifications,
      total,
      limit: safeLimit,
    } = await this.notificationsService.getPaginated(userId, limit, offset);

    const data: NotificationResponseDto[] = notifications.map((n) => ({
      id: n.notificationId,
      title: n.title,
      message: n.message,
      type: n.type,
      readAt: n.readAt?.toISOString() ?? null,
      metadata: n.metadata ?? {},
      createdAt: n.createdAt.toISOString(),
    }));

    return {
      data,
      total,
      page: Math.floor(offset / safeLimit) + 1,
      limit: safeLimit,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUnreadCount(
    @CurrentUserId() userId: string,
  ): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationsService.getUnreadCount(userId);

    return { unreadCount };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAsRead(notificationId, userId);
    return { message: 'Notification marked as read' };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async markAllAsRead(
    @CurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }
}
