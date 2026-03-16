import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto, UpdateChapterDto, ChapterResponseDto, ReorderChaptersDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Admin | Chapter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/chapter')
export class ChaptersAdminController {
    constructor(private readonly chaptersService: ChaptersService) { }

    @Post()
    @ApiOperation({ summary: 'สร้างบทใหม่' })
    @ApiResponse({ status: 201, description: 'Chapter created successfully', type: ChapterResponseDto })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    create(@Body() dto: CreateChapterDto): Promise<ChapterResponseDto> {
        return this.chaptersService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'ดึงบททั้งหมดสำหรับระดับ' })
    @ApiQuery({ name: 'level_id', type: Number, required: true, description: 'ID of the level to fetch chapters for' })
    @ApiResponse({ status: 200, description: 'List of chapters for the specified level', type: ChapterResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findByLevel(@Query('level_id', ParseIntPipe) levelId: number): Promise<ChapterResponseDto[]> {
        return this.chaptersService.findByLevel(levelId);
    }

    @Get('all')
    @ApiOperation({ summary: 'ดึงบททั้งหมด' })
    @ApiResponse({ status: 200, description: 'List of all chapters', type: ChapterResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findAll(): Promise<ChapterResponseDto[]> {
        return this.chaptersService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'ดึงบทตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Chapter found', type: ChapterResponseDto })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<ChapterResponseDto> {
        return this.chaptersService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'อัปเดตบทตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Chapter updated successfully', type: ChapterResponseDto })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    update(@Param('id', ParseIntPipe) id: number, @Body() updateChapterDto: UpdateChapterDto): Promise<ChapterResponseDto> {
        return this.chaptersService.update(id, updateChapterDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'ลบบทตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Chapter deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        return this.chaptersService.remove(id);
    }

    @Post('reorder')
    @ApiOperation({ summary: 'จัดลำดับบทภายในระดับ' })
    @ApiResponse({ status: 200, description: 'Chapters reordered successfully', type: ChapterResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    reorder(@Body() body: ReorderChaptersDto): Promise<ChapterResponseDto[]> {
        return this.chaptersService.reorder(body.level_id, body.chapter_ids);
    }
}