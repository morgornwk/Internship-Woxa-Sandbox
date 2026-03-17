import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Delete,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MediaVideosService } from './media-videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Upload | Video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('media/video')
export class MediaVideosController {
  constructor(private readonly svc: MediaVideosService) {}

  // สร้าง presigned URL สำหรับอัพโหลดวิดีโอ (สำหรับไฟล์ขนาด 1GB)
  @Post()
  @ApiOperation({
    summary: 'สร้าง URL ที่ลงชื่อล่วงหน้าสำหรับการอัปโหลดวิดีโอ',
  })
  @ApiBody({
    type: CreateVideoDto,
    examples: {
      createNew: {
        summary: 'อัปโหลดวิดีโอไฟล์ใหม่',
        value: {
          original_filename: 'sample.mp4',
          mime_type: 'video/mp4',
          size_bytes: 10485760,
        },
      },
      attachExisting: {
        summary: 'อัปโหลดให้ media asset เดิม (optional)',
        value: {
          media_asset_id: 123,
          original_filename: 'lecture-1.mp4',
          mime_type: 'video/mp4',
          size_bytes: 52428800,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or file size exceeds limit',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Related entities not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async presign(@CurrentUserId() adminId: string, @Body() dto: CreateVideoDto) {
    return this.svc.createPresignedUpload(dto, adminId);
  }

  @Post(':id/confirm')
  @ApiOperation({
    summary: 'ยืนยันการอัปโหลดไฟล์วิดีโอและเปลี่ยนสถานะเป็น Ready',
  })
  @ApiResponse({ status: 200, description: 'Confirmed' })
  @ApiResponse({ status: 400, description: 'File not uploaded yet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async confirm(@Param('id') id: string) {
    return this.svc.confirmUpload(Number(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'รับ URL สาธารณะเพื่อดูวิดีโอตาม ID' })
  @ApiParam({ name: 'id', description: 'Video asset id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Public URL for viewing' })
  @ApiResponse({ status: 400, description: 'Invalid video ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getViewUrl(@Param('id') id: string) {
    return this.svc.getPublicViewUrl(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'อัปเดตข้อมูลวิดีโอด้วย ID' })
  @ApiParam({ name: 'id', description: 'Video asset id', type: 'number' })
  @ApiBody({
    type: UpdateVideoDto,
    examples: {
      setPublicUrl: {
        summary: 'ตั้งค่า public_url หลังอัปโหลดเสร็จ',
        value: {
          public_url: 'https://cdn.example.com/videos/abc.mp4',
          status: 'ready',
        },
      },
      updateMeta: {
        summary: 'อัปเดต metadata',
        value: {
          original_filename: 'lecture-1.mp4',
          mime_type: 'video/mp4',
          size_bytes: 10485760,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({
    status: 400,
    description: 'No fields to update / invalid payload',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async patch(@Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.svc.updateVideoAsset(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบวิดีโอตาม ID' })
  @ApiParam({ name: 'id', description: 'Video asset id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Video deleted' })
  @ApiResponse({ status: 400, description: 'Invalid video ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteVideo(@Param('id') id: string) {
    return this.svc.deleteVideoById(Number(id));
  }
}
