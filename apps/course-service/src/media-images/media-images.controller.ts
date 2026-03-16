import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors, Delete, Patch, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { MediaImagesService } from './media-images.service';
import { UpdateImageDto } from './dto/update-image.dto';
import { CurrentUserId, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';

@ApiTags('Upload | Image')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('media/image')
export class MediaImagesController {
  constructor(private readonly svc: MediaImagesService) { }

  @Post('upload')
  @ApiOperation({ summary: 'อัพโหลดภาพ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file to upload' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  }))
  async upload(@CurrentUserId() adminId: string, @UploadedFile() file: Express.Multer.File) {
    return this.svc.uploadImageFileAndPersist(file, adminId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'รับ URL สาธารณะโดยใช้รหัสรูปภาพ' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Public URL retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid image ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getImage(@Param('id') id: string) {
    return this.svc.getPublicUrlById(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'อัปเดตข้อมูลรูปภาพด้วย ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    type: UpdateImageDto,
    examples: {
      updateMeta: {
        summary: 'อัปเดต metadata ของรูปภาพ',
        value: {
          original_filename: 'lecture-1.jpg',
          mime_type: 'image/jpeg',
        },
      },
      renameOnly: {
        summary: 'เปลี่ยนชื่อไฟล์เดิมอย่างเดียว',
        value: {
          original_filename: 'cover.png',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'No fields to update / invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async patch(@Param('id') id: string, @Body() dto: UpdateImageDto) {
    return this.svc.updateImageAsset(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบรูปภาพตาม ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async delete(@Param('id') id: string) {
    return this.svc.deleteImageById(Number(id));
  }
}
