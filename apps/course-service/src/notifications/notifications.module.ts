import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

import { AnnouncementsModule } from '../announcements/announcements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),

    // ใช้ forwardRef ถ้ามี circular dependency
    forwardRef(() => AnnouncementsModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [
    NotificationsService, // ให้ module อื่น inject ได้
  ],
})
export class NotificationsModule {}
