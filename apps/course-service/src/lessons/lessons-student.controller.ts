import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { LessonResponseDto } from './dto/lesson';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Student | Lesson')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/lesson')
export class LessonsStudentController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiOperation({ summary: 'ดึงบทเรียนทั้งหมดสำหรับบท' })
  @ApiQuery({ name: 'chapterId', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of lessons for the specified chapter',
    type: LessonResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  findByChapter(
    @Query('chapterId', ParseIntPipe) chapterId: number,
  ): Promise<LessonResponseDto[]> {
    return this.lessonsService.findPublishedByChapter(chapterId);
  }

  @Get('all')
  @ApiOperation({ summary: 'ดึงบทเรียนทั้งหมด' })
  @ApiResponse({
    status: 200,
    description: 'List of all lessons',
    type: LessonResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lessons not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  findAll(): Promise<LessonResponseDto[]> {
    return this.lessonsService.findAllPublished();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดึงบทเรียนตาม ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lesson found',
    type: LessonResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<LessonResponseDto> {
    return this.lessonsService.findOnePublished(id);
  }
}
