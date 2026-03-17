import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { AnnouncementsService } from '../announcements/announcements.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  private assertUserId(userId: string) {
    if (!userId) throw new UnauthorizedException();
  }

  private assertPagination(limit: number, offset: number) {
    if (limit < 1) throw new BadRequestException('limit must be positive');
    if (offset < 0) throw new BadRequestException('offset must be >= 0');
  }

  // ดึงการแจ้งเตือนแบบแบ่งหน้า (pagination) โดยจะทำการซิงค์ประกาศก่อนทุกครั้งเพื่อให้แน่ใจว่าข้อมูลเป็นปัจจุบัน
  async getPaginated(userId: string, limit: number, offset: number) {
    this.assertUserId(userId);
    this.assertPagination(limit, offset);

    const safeLimit = Math.min(limit, 50);

    await this.syncAnnouncements(userId);

    const [notifications, total] = await Promise.all([
      this.notificationRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: safeLimit,
        skip: offset,
      }),
      this.notificationRepo.count({ where: { userId } }),
    ]);

    return { notifications, total, limit: safeLimit };
  }

  // ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน โดยจะทำการซิงค์ประกาศก่อนทุกครั้งเพื่อให้แน่ใจว่าข้อมูลเป็นปัจจุบัน
  async getUnreadCount(userId: string): Promise<number> {
    this.assertUserId(userId);

    await this.syncAnnouncements(userId);

    return this.notificationRepo.count({
      where: { userId, readAt: IsNull() },
    });
  }

  // ทำเครื่องหมายการแจ้งเตือนว่าอ่านแล้ว
  async markAsRead(notificationId: string, userId: string) {
    this.assertUserId(userId);

    await this.notificationRepo.update(
      { notificationId, userId },
      { readAt: new Date() },
    );
  }

  // ทำเครื่องหมายการแจ้งเตือนทั้งหมดของผู้ใช้ว่าอ่านแล้ว
  async markAllAsRead(userId: string) {
    this.assertUserId(userId);

    await this.notificationRepo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  // ซิงค์ประกาศที่ยังไม่หมดอายุจาก AnnouncementsService เข้าสู่ตาราง Notifications ของผู้ใช้แต่ละคน
  // โดยจะเพิ่มการแจ้งเตือนใหม่สำหรับประกาศที่ยังไม่มีในระบบ และลบการแจ้งเตือนที่เกี่ยวข้องกับประกาศที่หมดอายุไปแล้ว
  private async syncAnnouncements(userId: string) {
    const activeAnnouncements = await this.announcementsService.findActive();

    const activeIds = activeAnnouncements.map((a) => String(a.announcement_id));

    const existing = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere(`n.metadata ->> 'source' = 'announcement'`)
      .getMany();

    const existingMap = new Map<string, Notification>();

    for (const n of existing) {
      const id = String(n.metadata?.announcementId ?? '');
      if (!existingMap.has(id)) {
        existingMap.set(id, n);
      }
    }

    // เพิ่มการแจ้งเตือนใหม่สำหรับประกาศที่ยังไม่มีในระบบ
    const toInsert = activeAnnouncements
      .filter((a) => !existingMap.has(String(a.announcement_id)))
      .map((a) =>
        this.notificationRepo.create({
          userId,
          title: a.title,
          message: a.title,
          type: 'info',
          metadata: {
            source: 'announcement',
            announcementId: String(a.announcement_id),
            imageUrl: a.imageUrl ?? null,
            deepLink: a.deepLink ?? null,
            priority: a.priority,
          },
        }),
      );

    if (toInsert.length) {
      await this.notificationRepo.save(toInsert);
    }

    // ลบการแจ้งเตือนที่เกี่ยวข้องกับประกาศที่หมดอายุไปแล้ว
    const staleIds = existing
      .filter(
        (n) => !activeIds.includes(String(n.metadata?.announcementId ?? '')),
      )
      .map((n) => n.notificationId);

    if (staleIds.length) {
      await this.notificationRepo.delete({ notificationId: In(staleIds) });
    }
  }

  // สร้างการแจ้งเตือนใหม่ด้วยข้อมูลที่กำหนด
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    metadata?: Record<string, any>,
  ) {
    const notification = this.notificationRepo.create({
      userId,
      title,
      message,
      type,
      metadata,
    });

    return this.notificationRepo.save(notification);
  }
}
