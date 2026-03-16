import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { LevelsService } from './levels.service';
import { CreateLevelDto, UpdateLevelDto, LevelResponseDto, ReorderLevelsDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Admin | Level')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/level')
export class LevelsAdminController {
    constructor(private readonly levelsService: LevelsService) { }

    @Post()
    @ApiOperation({ summary: 'สร้างระดับใหม่' })
    @ApiBody({
        type: CreateLevelDto,
        examples: {
            example1: {
                summary: 'Create level example',
                value: {
                    level_title: 'Level 1',
                    level_description: 'Introduction to programming concepts',
                    course_id: 1,
                    orderIndex: 0,
                    level_ImageUrl: 'https://cdn.skillacademy.com/images/level1.jpg',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Level created successfully', type: LevelResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    create(@Body() dto: CreateLevelDto): Promise<LevelResponseDto> {
        return this.levelsService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'ดึงระดับทั้งหมดสำหรับคอร์ส' })
    @ApiQuery({ name: 'course_id', required: true, type: Number })
    @ApiResponse({ status: 200, description: 'List of levels for the specified course', type: LevelResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Invalid course ID' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findByCourse(@Query('course_id', ParseIntPipe) course_id: number,): Promise<LevelResponseDto[]> {
        return this.levelsService.findByCourse(course_id);
    }

    @Get('all')
    @ApiOperation({ summary: 'ดึงระดับทั้งหมด' })
    @ApiResponse({ status: 200, description: 'List of all levels', type: LevelResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findAll(): Promise<LevelResponseDto[]> {
        return this.levelsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'ดึงระดับตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Level found', type: LevelResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid level ID' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<LevelResponseDto> {
        return this.levelsService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'อัปเดตระดับตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Level updated successfully', type: LevelResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    update(@Param('id', ParseIntPipe) id: number, @Body() updateLevelDto: UpdateLevelDto): Promise<LevelResponseDto> {
        return this.levelsService.update(id, updateLevelDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'ลบระดับตาม ID' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'Level deleted successfully' })
    @ApiResponse({ status: 400, description: 'Invalid level ID' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Level not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        return this.levelsService.remove(id);
    }

    @Post('reorder')
    @ApiOperation({ summary: 'จัดลำดับระดับภายในคอร์ส' })
    @ApiBody({
        type: ReorderLevelsDto,
        examples: {
            example1: {
                summary: 'Reorder levels example',
                value: {
                    course_id: 1,
                    level_ids: [3, 1, 2]
                },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Levels reordered successfully', type: LevelResponseDto, isArray: true })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    reorder(@Body() body: ReorderLevelsDto): Promise<LevelResponseDto[]> {
        return this.levelsService.reorder(body.course_id, body.level_ids);
    }
}