import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const notificationsService = {
    getPaginated: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get(NotificationsController);
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('delegates and maps to DTO + calculates page', async () => {
      notificationsService.getPaginated.mockResolvedValue({
        notifications: [
          {
            notificationId: 'n1',
            title: 't1',
            message: 'm1',
            type: 'info',
            readAt: null,
            metadata: null,
            createdAt: new Date('2026-03-05T00:00:00.000Z'),
          },
          {
            notificationId: 'n2',
            title: 't2',
            message: 'm2',
            type: 'success',
            readAt: new Date('2026-03-05T01:00:00.000Z'),
            metadata: { a: 1 },
            createdAt: new Date('2026-03-05T02:00:00.000Z'),
          },
        ],
        total: 2,
        limit: 10,
      });

      const res = await controller.getNotifications('u1', 20, 20);

      expect(notificationsService.getPaginated).toHaveBeenCalledWith(
        'u1',
        20,
        20,
      );
      expect(res).toEqual({
        data: [
          {
            id: 'n1',
            title: 't1',
            message: 'm1',
            type: 'info',
            readAt: null,
            metadata: {},
            createdAt: '2026-03-05T00:00:00.000Z',
          },
          {
            id: 'n2',
            title: 't2',
            message: 'm2',
            type: 'success',
            readAt: '2026-03-05T01:00:00.000Z',
            metadata: { a: 1 },
            createdAt: '2026-03-05T02:00:00.000Z',
          },
        ],
        total: 2,
        page: 3,
        limit: 10,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('delegates to service', async () => {
      notificationsService.getUnreadCount.mockResolvedValue(7);

      await expect(controller.getUnreadCount('u1')).resolves.toEqual({
        unreadCount: 7,
      });
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('u1');
    });
  });

  describe('markAsRead', () => {
    it('delegates to service', async () => {
      notificationsService.markAsRead.mockResolvedValue(undefined);

      await expect(controller.markAsRead('n1', 'u1')).resolves.toEqual({
        message: 'Notification marked as read',
      });
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('n1', 'u1');
    });

    it('propagates errors', async () => {
      notificationsService.markAsRead.mockRejectedValue(new Error('boom'));

      await expect(controller.markAsRead('n1', 'u1')).rejects.toThrow('boom');
    });
  });

  describe('markAllAsRead', () => {
    it('delegates to service', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(undefined);

      await expect(controller.markAllAsRead('u1')).resolves.toEqual({
        message: 'All notifications marked as read',
      });
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('u1');
    });
  });
});
