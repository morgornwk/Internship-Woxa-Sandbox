import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUserId, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';
import { AssetLibraryService } from './asset-library.service';
import { CreateAssetVideoDto, UpdateAssetImageDto, UpdateAssetVideoDto } from './dto';

@ApiTags('Asset Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('asset-library')
export class AssetLibraryController {
    constructor(private readonly svc: AssetLibraryService) { }

    @Post('image/upload')
    @ApiOperation({ summary: 'อัพโหลดภาพเข้า Asset Library' })
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
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    @UseInterceptors(
        FileInterceptor('file', {
            storage: multer.memoryStorage(),
            limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
        }),
    )
    async uploadAssetImage(
        @CurrentUserId() adminId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.svc.uploadAssetImage(adminId, file);
    }
    
    @Post('video/upload')
    @ApiOperation({ summary: 'สร้าง Presigned URL สำหรับอัปโหลดวิดีโอเข้า Asset Library' })
    @ApiBody({ type: CreateAssetVideoDto })
    @ApiResponse({ status: 201, description: 'Presigned URL created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or file size exceeds limit' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async presignAssetVideo(
        @CurrentUserId() adminId: string,
        @Body() dto: CreateAssetVideoDto,
    ) {
        return this.svc.createAssetVideoPresign(adminId, dto);
    }
    
    @Post('video/:id/confirm')
    @ApiOperation({ summary: 'ยืนยันวิดีโอใน Asset Library หลังอัปโหลดเสร็จ' })
    @ApiResponse({ status: 200, description: 'Confirmed' })
    @ApiResponse({ status: 400, description: 'File not uploaded yet' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Video not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async confirmAssetVideo(@Param('id') id: string) {
        return this.svc.confirmAssetVideo(Number(id));
    }
    
    @Get()
    @ApiOperation({ summary: 'ดึงรายการ Asset Library ทั้งหมด (รวม image + video)' })
    @ApiResponse({ status: 200, description: 'List of assets retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'No assets found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getAssetLibraryAll() {
        return this.svc.getAssetLibraryAll();
    }
    
    @Get(':id')
    @ApiOperation({ summary: 'ดึงรายละเอียด Asset Library ตาม ID (รวม image + video)' })
    @ApiResponse({ status: 200, description: 'Asset retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Asset not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getAssetById(@Param('id') id: string) {
        return this.svc.getAssetById(Number(id));
    }

    @Patch('image/:id')
    @ApiOperation({ summary: 'อัปเดตข้อมูลภาพใน Asset Library ตาม ID' })
    @ApiBody({ type: UpdateAssetImageDto })
    @ApiResponse({ status: 200, description: 'Image updated successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Image not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async updateAssetImage(@Param('id') id: string, @Body() dto: UpdateAssetImageDto) {
        return this.svc.updateAssetImage(Number(id), dto);
    }

    @Patch('video/:id')
    @ApiOperation({ summary: 'อัปเดตข้อมูลวิดีโอใน Asset Library ตาม ID' })
    @ApiBody({ type: UpdateAssetVideoDto })
    @ApiResponse({ status: 200, description: 'Video updated successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Video not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async updateAssetVideo(@Param('id') id: string, @Body() dto: UpdateAssetVideoDto) {
        return this.svc.updateAssetVideo(Number(id), dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'ลบ Asset จาก Asset Library ตาม ID (รวม image + video)' })
    @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Asset not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async deleteAssetById(@Param('id') id: string) {
        return this.svc.deleteAssetById(Number(id));
    }
}