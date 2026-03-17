import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';

import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { AnnouncementsService } from '../announcements/announcements.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  type NotificationRepoMock = {
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  type AnnouncementsServiceMock = {
    findActive: jest.Mock;
  };

  let repo: NotificationRepoMock;
  let announcements: AnnouncementsServiceMock;

  const makeNotification = (
    overrides: Partial<Notification> = {},
  ): Notification =>
    ({
      notificationId: 'n1',
      userId: 'u1',
      title: 't',
      message: 'm',
      type: 'info',
      metadata: null as any,
      readAt: null as any,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      ...overrides,
    }) as Notification;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: AnnouncementsService,
          useValue: {
            findActive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
    repo = module.get(getRepositoryToken(Notification));
    announcements = module.get(AnnouncementsService);
    jest.clearAllMocks();
  });

  describe('getPaginated', () => {
    it('throws UnauthorizedException when userId missing', async () => {
      await expect(service.getPaginated('', 10, 0)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException on invalid pagination', async () => {
      await expect(service.getPaginated('u1', 0, 0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.getPaginated('u1', 1, -1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('syncs announcements then returns {notifications,total,limit}', async () => {
      announcements.findActive.mockResolvedValue([
        {
          announcement_id: 1,
          title: 'A1',
          imageUrl: null,
          deepLink: null,
          priority: 1,
        },
      ]);

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue([
        makeNotification({ notificationId: 'n1' }),
      ] as any);

      repo.find.mockResolvedValue([makeNotification({ notificationId: 'n1' })]);
      repo.count.mockResolvedValue(1);

      const result = await service.getPaginated('u1', 100, 0);

      expect(announcements.findActive).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.limit).toBe(50);
      expect(result.total).toBe(1);
      expect(result.notifications).toHaveLength(1);
    });
  });

  describe('getUnreadCount', () => {
    it('throws UnauthorizedException when userId missing', async () => {
      await expect(service.getUnreadCount('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('syncs announcements then returns count', async () => {
      announcements.findActive.mockResolvedValue([]);
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      repo.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('u1');

      expect(announcements.findActive).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });

  describe('markAsRead / markAllAsRead', () => {
    it('markAsRead throws UnauthorizedException when userId missing', async () => {
      await expect(service.markAsRead('n1', '')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('markAsRead updates by notificationId+userId', async () => {
      await service.markAsRead('n1', 'u1');
      expect(repo.update).toHaveBeenCalledWith(
        { notificationId: 'n1', userId: 'u1' },
        expect.any(Object),
      );
    });

    it('markAllAsRead throws UnauthorizedException when userId missing', async () => {
      await expect(service.markAllAsRead('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('markAllAsRead updates all unread', async () => {
      await service.markAllAsRead('u1');
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('createNotification', () => {
    it('creates and saves', async () => {
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(makeNotification({ notificationId: 'n1' }));

      const result = await service.createNotification('u1', 't', 'm');
      expect(result.notificationId).toBe('n1');
    });

    it('passes type and metadata through', async () => {
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockImplementation(async (x: any) => ({
        ...makeNotification(),
        ...x,
      }));

      const result = await service.createNotification(
        'u1',
        't',
        'm',
        'warning',
        { a: 1 },
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          title: 't',
          message: 'm',
          type: 'warning',
          metadata: { a: 1 },
        }),
      );
      expect(result.type).toBe('warning');
      expect(result.metadata).toEqual({ a: 1 });
    });
  });

  describe('syncAnnouncements via getPaginated/getUnreadCount', () => {
    it('does not insert when all active announcements already exist', async () => {
      announcements.findActive.mockResolvedValue([
        {
          announcement_id: 1,
          title: 'A1',
          imageUrl: null,
          deepLink: null,
          priority: 1,
        },
      ]);

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          makeNotification({
            notificationId: 'n1',
            metadata: { source: 'announcement', announcementId: '1' },
          }),
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      repo.find.mockResolvedValue([makeNotification({ notificationId: 'n1' })]);
      repo.count.mockResolvedValue(1);

      await service.getPaginated('u1', 10, 0);

      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes stale announcement notifications', async () => {
      announcements.findActive.mockResolvedValue([]);

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          makeNotification({
            notificationId: 'n1',
            metadata: { source: 'announcement', announcementId: '1' },
          }),
          makeNotification({
            notificationId: 'n2',
            metadata: { source: 'announcement', announcementId: '2' },
          }),
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      repo.find.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.getPaginated('u1', 10, 0);

      expect(repo.delete).toHaveBeenCalledWith({
        notificationId: In(['n1', 'n2']),
      });
    });
  });
});
