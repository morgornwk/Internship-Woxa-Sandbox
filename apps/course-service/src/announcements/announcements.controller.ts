import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUserId, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';

import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('Announcement')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('active')
  @ApiOperation({
    summary: 'ดึงป้ายประกาศที่ใช้งานได้ (Public)',
    description:
      '**Public Endpoint - ไม่ต้อง Login**\n\nดึงป้ายประกาศที่ active และอยู่ในช่วงเวลาที่กำหนด พร้อม placeholder image ถ้าไม่มีรูปภาพ\n\n🔓 **ไม่ต้อง Authentication** - ทุกคนสามารถเรียกได้\n📱 **ใช้สำหรับ** - Frontend แสดงป้ายประกาศในหน้าแรก',
  })
  @ApiResponse({
    status: 200,
    description:
      '**ดึงป้ายประกาศสำเร็จ (Public)**\n\n✅ สำเร็จ - คืนข้อมูลป้ายประกาศที่ active ทั้งหมด\n🖼️ มี placeholder image ถ้าป้ายไม่มีรูปภาพจริง\n🔓 ไม่ต้อง Authentication',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              announcement_id: { type: 'number', example: 1 },
              title: {
                type: 'string',
                example: '🔥 เปิดคอร์สใหม่! React Advanced 2025',
              },
              imageUrl: {
                type: 'string',
                example:
                  'https://cdn.example.com/banners/react-course-2025.jpg',
                nullable: true,
              },
              deepLink: {
                type: 'string',
                example: '/courses/react-advanced-2025',
              },
              activeStatus: { type: 'boolean', example: true },
              priority: { type: 'number', example: 10 },
              startDate: {
                type: 'string',
                example: '2025-02-20T00:00:00Z',
                nullable: true,
              },
              endDate: {
                type: 'string',
                example: '2025-03-20T23:59:59Z',
                nullable: true,
              },
              createdAt: { type: 'string', example: '2025-02-17T10:00:00Z' },
              updatedAt: { type: 'string', example: '2025-02-17T10:00:00Z' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No active announcements found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findActive() {
    const data = await this.announcementsService.findActive();
    const placeholderImageUrl =
      this.announcementsService.getPlaceholderImageUrl();

    return {
      success: true,
      data: data.map((a) => ({
        ...a,
        imageUrl: a.imageUrl || placeholderImageUrl || null,
      })),
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post()
  @ApiOperation({
    summary: 'สร้างป้ายประกาศใหม่ (Admin Only)',
    description:
      '**Admin Only - ต้อง Login + Admin Role**\n\nAdmin เท่านั้นสามารถสร้างป้ายประกาศใหม่ได้ สามารถกำหนดรูปภาพ ลิงก์ และช่วงเวลาที่แสดงได้\n\n🔐 **ต้อง Authentication** - JWT Token + Admin Role\n📝 **สร้างป้าย** - สามารถกำหนด deepLink, date range, priority',
  })
  @ApiResponse({
    status: 201,
    description: 'สร้างป้ายประกาศใหม่ (Admin เท่านั้น)',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Get()
  @ApiOperation({
    summary: 'ดึงป้ายประกาศทั้งหมด',
    description:
      'Admin เท่านั้นสามารถดึงป้ายประกาศทั้งหมดได้ รวมทั้งที่ไม่ active',
  })
  @ApiResponse({
    status: 200,
    description: 'ดึงป้ายประกาศทั้งหมด (Admin เท่านั้น)',
    type: AnnouncementResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No announcements found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll() {
    return this.announcementsService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Get(':id')
  @ApiOperation({
    summary: 'ดึงป้ายประกาศตาม ID',
    description: 'Admin เท่านั้นสามารถดึงรายละเอียดป้ายประกาศตาม ID ที่ระบุได้',
  })
  @ApiResponse({
    status: 200,
    description: 'ดึงป้ายประกาศตาม ID (Admin เท่านั้น)',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.announcementsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Patch(':id')
  @ApiOperation({
    summary: 'อัปเดตป้ายประกาศ',
    description:
      'Admin เท่านั้นสามารถแก้ไขข้อมูลป้ายประกาศได้ เช่น หัวข้อ รูปภาพ ลิงก์ หรือสถานะ',
  })
  @ApiResponse({
    status: 200,
    description: 'อัปเดตป้ายประกาศ (Admin เท่านั้น)',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post(':id/upload-image')
  @ApiOperation({
    summary: 'อัปโหลดรูปภาพป้ายประกาศ',
    description:
      'Admin เท่านั้นสามารถอัปโหลดรูปภาพสำหรับป้ายประกาศได้ รองรับไฟล์ jpg/png/webp ขนาดสูงสุด 5MB และจะอัปโหลดไปยัง S3 และอัปเดต URL ให้อัตโนมัติ',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file to upload (max 5MB, jpg/png/webp)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'อัปโหลดรูปภาพสำเร็จและอัปเดต URL (Admin เท่านั้น)',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file type or size',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserId() adminId: string,
  ) {
    return this.announcementsService.uploadBannerImage(id, file, adminId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post('sync-active')
  @ApiOperation({
    summary: 'บังคับประกาศสถานะการทำงาน (สำหรับผู้ดูแลระบบเท่านั้น)',
    description:
      '**Admin Only - ต้อง Login + Admin Role**\n\nบังคับให้รันการ sync สถานะป้ายประกาศตามวันที่ทันที โดยไม่ต้องรอ cron ทำงาน 1 นาที\n\n🔐 **ต้อง Authentication** - JWT Token + Admin Role\n⚡ **Force Sync** - ทำงานทันที ไม่ต้องรอ cron\n🔧 **ใช้สำหรับ** - ทดสอบ หรือเปิด/ปิดป้ายฉุกเฉิน',
  })
  @ApiResponse({
    status: 200,
    description:
      '**Force sync สำเร็จ (Admin เท่านั้น)**\n\n✅ สำเร็จ - sync สถานะป้ายประกาศตาม startDate/endDate เรียบร้อย\n📊 จะอัปเดต activeStatus ของป้ายที่ถึงเวลาแล้วทั้งหมด',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Sync completed' },
        timestamp: { type: 'string', example: '2026-02-27T11:47:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No announcements found to sync' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async forceSyncActiveStatus() {
    await this.announcementsService.syncAnnouncementStatusByDate();
    return {
      success: true,
      message: 'Sync completed',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Delete(':id')
  @ApiOperation({
    summary: 'ลบป้ายประกาศ',
    description:
      'Admin เท่านั้นสามารถลบป้ายประกาศตาม ID ที่ระบุได้ การลบจะถาวรและไม่สามารถกู้คืนได้',
  })
  @ApiResponse({ status: 200, description: 'ลบป้ายประกาศ (Admin เท่านั้น)' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    return await this.announcementsService.remove(id);
  }
}
