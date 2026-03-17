import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { MediaImagesService } from '../media-images/media-images.service';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly mediaImagesService: MediaImagesService,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) {}

  private toResponseDto(announcement: Announcement): AnnouncementResponseDto {
    return {
      announcement_id: announcement.announcement_id,
      title: announcement.title,
      imageUrl: announcement.imageUrl ?? null,
      deepLink: announcement.deepLink ?? null,
      activeStatus: announcement.activeStatus,
      priority: announcement.priority,
      startDate: announcement.startDate ?? null,
      endDate: announcement.endDate ?? null,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }

  // Create a new announcement
  async create(dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    if (dto.deepLink) {
      this.assertValidDeepLink(dto.deepLink);
    }

    const announcement = this.announcementRepository.create({
      title: dto.title,
      imageUrl: dto.imageUrl ?? null,
      deepLink: dto.deepLink ?? null,
      activeStatus: dto.activeStatus ?? false,
      priority: dto.priority ?? 0,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });

    const saved = await this.announcementRepository.save(announcement);
    return this.toResponseDto(saved);
  }

  // function ตรวจสอบและอัปเดตสถานะของป้ายประกาศตามวันที่และเวลาปัจจุบัน
  @Cron(CronExpression.EVERY_MINUTE)
  async syncAnnouncementStatusByDate(): Promise<void> {
    // start_date/end_date เก็บเป็น timestamp (ไม่มี timezone) ใช้เวลา Bangkok (UTC+7)
    const nowExpr = "(NOW() AT TIME ZONE 'Asia/Bangkok')";

    // เปิดประกาศที่ถึงเวลาเปิดและยังไม่หมดอายุ
    const activatedResult = await this.announcementRepository
      .createQueryBuilder()
      .update(Announcement)
      .set({ activeStatus: true })
      .where('active_status = :active', { active: false })
      .andWhere('start_date IS NOT NULL')
      .andWhere(`start_date <= ${nowExpr}`)
      .andWhere(
        new Brackets((qb) => {
          qb.where('end_date IS NULL').orWhere(`end_date >= ${nowExpr}`);
        }),
      )
      .execute();

    if (activatedResult.affected && activatedResult.affected > 0) {
      this.logger.log(`Activated ${activatedResult.affected} announcement(s)`);
      return;
    }

    // ปิดประกาศที่หมดอายุหรือยังไม่ถึงเวลาเปิด
    const deactivatedResult = await this.announcementRepository
      .createQueryBuilder()
      .update(Announcement)
      .set({ activeStatus: false })
      .where('active_status = :active', { active: true })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            `start_date IS NOT NULL AND start_date > ${nowExpr}`,
          ).orWhere(`end_date IS NOT NULL AND end_date < ${nowExpr}`);
        }),
      )
      .execute();

    if (deactivatedResult.affected && deactivatedResult.affected > 0) {
      this.logger.log(
        `Deactivated ${deactivatedResult.affected} announcement(s)`,
      );
      return;
    }
  }

  async findAll(): Promise<AnnouncementResponseDto[]> {
    const list = await this.announcementRepository.find({
      order: { priority: 'DESC', createdAt: 'DESC' },
    });

    return list.map((a) => this.toResponseDto(a));
  }

  // ดึงป้ายประกาศที่ active และอยู่ในช่วงเวลาที่กำหนด พร้อม placeholder image ถ้าไม่มีรูปภาพ
  async findActive(): Promise<AnnouncementResponseDto[]> {
    const nowExpr = "(NOW() AT TIME ZONE 'Asia/Bangkok')";

    const list = await this.announcementRepository
      .createQueryBuilder('a')
      .where('a.active_status = :active', { active: true })
      .andWhere(
        new Brackets((qb) => {
          qb.where('a.start_date IS NULL').orWhere(
            `a.start_date <= ${nowExpr}`,
          );
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('a.end_date IS NULL').orWhere(`a.end_date >= ${nowExpr}`);
        }),
      )
      .orderBy('a.priority', 'DESC')
      .addOrderBy('a.created_at', 'DESC')
      // .limit(limit)
      .getMany();

    return list.map((a) => this.toResponseDto(a));
  }

  // อัปโหลดรูปภาพสำหรับป้ายประกาศและอัปเดต URL ในฐานข้อมูล
  async uploadBannerImage(
    id: number,
    file: Express.Multer.File,
    adminId: string,
  ): Promise<AnnouncementResponseDto> {
    const announcementEntity = await this.findOneEntity(id);

    const uploaded = await this.mediaImagesService.uploadImageFileAndPersist(
      file,
      adminId,
    );
    announcementEntity.imageUrl = uploaded.url;

    const saved = await this.announcementRepository.save(announcementEntity);
    return this.toResponseDto(saved);
  }

  // ดึง URL รูปภาพ placeholder สำหรับประกาศ (ใช้เมื่อประกาศไม่มีรูปภาพ)
  getPlaceholderImageUrl(): string {
    return String(
      'https://cdn.skllracademy.com/images/9f6e04bc-981a-43e2-947d-22f779c09f79.jpg',
    );
  }

  // หา announcement โดยใช้ ID
  async findOne(id: number): Promise<AnnouncementResponseDto> {
    const announcement = await this.findOneEntity(id);
    return this.toResponseDto(announcement);
  }

  private async findOneEntity(id: number): Promise<Announcement> {
    const announcement = await this.announcementRepository.findOne({
      where: { announcement_id: id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }

  // อัปเดตข้อมูลป้ายประกาศ
  async update(
    id: number,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.findOneEntity(id);

    if (dto.deepLink) {
      this.assertValidDeepLink(dto.deepLink);
    }

    if (dto.title !== undefined) {
      announcement.title = dto.title;
    }

    if (dto.imageUrl !== undefined) {
      announcement.imageUrl = dto.imageUrl;
    }

    if (dto.deepLink !== undefined) {
      announcement.deepLink = dto.deepLink;
    }

    if (dto.activeStatus !== undefined) {
      announcement.activeStatus = dto.activeStatus;
    }

    if (dto.priority !== undefined) {
      announcement.priority = dto.priority;
    }

    if (dto.startDate !== undefined) {
      announcement.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }

    if (dto.endDate !== undefined) {
      announcement.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }

    const saved = await this.announcementRepository.save(announcement);
    return this.toResponseDto(saved);
  }

  // ลบป้ายประกาศ
  async remove(id: number): Promise<{ message: string }> {
    const announcement = await this.findOneEntity(id);
    await this.announcementRepository.remove(announcement);
    return { message: `Announcement with ID ${id} deleted successfully` };
  }

  // ฟังก์ชันตรวจสอบความถูกต้องของ deepLink (ต้องเป็น relative path หรือ absolute URL)
  private assertValidDeepLink(value: string): void {
    try {
      if (value.startsWith('/')) {
        return;
      }

      // ถ้าไม่ใช่ relative path ให้ตรวจสอบว่าเป็น absolute URL ที่ถูกต้องหรือไม่
      new URL(value);
    } catch {
      throw new BadRequestException('Invalid deepLink');
    }
  }
}
