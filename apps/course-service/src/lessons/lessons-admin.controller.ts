import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import {
  CreateLessonDto,
  UpdateLessonDto,
  LessonResponseDto,
  ReorderLessonsDto,
} from './dto/lesson';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Admin | Lesson')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/lesson')
export class LessonsAdminController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @ApiOperation({ summary: 'สร้างบทเรียนใหม่' })
  @ApiBody({
    type: CreateLessonDto,
    examples: {
      article: {
        summary: 'ตัวอย่าง: บทเรียนแบบบทความ',
        value: {
          lesson_title: 'article title',
          lesson_description: 'Learn about variable types and declarations',
          chapter_id: 1,
          lesson_type: 'article',
          orderIndex: 0,
          lesson_ImageUrl: 'https://cdn.skillacademy.com/images/abc123.jpg',
          lesson_videoUrl: null,
        },
      },
      video: {
        summary: 'ตัวอย่าง: บทเรียนแบบวิดีโอ',
        value: {
          lesson_title: 'video title',
          lesson_description: 'Watch how variables work in practice',
          chapter_id: 1,
          lesson_type: 'video',
          orderIndex: 1,
          lesson_ImageUrl: 'https://cdn.skillacademy.com/images/def456.jpg',
          lesson_videoUrl: 'https://cdn.skillacademy.com/videos/abc123.mp4',
        },
      },
      quiz: {
        summary: 'ตัวอย่าง: บทเรียนแบบแบบทดสอบ',
        value: {
          lesson_title: 'quiz title',
          lesson_description: 'Test your knowledge about variables',
          chapter_id: 1,
          lesson_type: 'quiz',
          orderIndex: 2,
          lesson_ImageUrl: 'https://cdn.skillacademy.com/images/ghi789.jpg',
          lesson_videoUrl: null,
        },
      },
      checkpoint: {
        summary: 'ตัวอย่าง: บทเรียนแบบจุดตรวจสอบ',
        value: {
          lesson_title: 'Checkpoint title',
          lesson_description: 'Quick check on variable concepts',
          chapter_id: 1,
          lesson_type: 'checkpoint',
          orderIndex: 3,
          lesson_ImageUrl: 'https://cdn.skillacademy.com/images/jkl012.jpg',
          lesson_videoUrl: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Lesson created successfully',
    type: LessonResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  create(@Body() dto: CreateLessonDto): Promise<LessonResponseDto> {
    return this.lessonsService.create(dto);
  }

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
    return this.lessonsService.findByChapter(chapterId);
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
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  findAll(): Promise<LessonResponseDto[]> {
    return this.lessonsService.findAll();
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
    return this.lessonsService.findOneAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'อัปเดตบทเรียนตาม ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    type: CreateLessonDto,
    examples: {
      article: {
        summary: 'ตัวอย่าง: บทเรียนแบบบทความ',
        value: {
          lesson_title: 'updated article title',
          lesson_description:
            'Updated description about variable types and declarations',
          chapter_id: 1,
          lesson_type: 'article',
          orderIndex: 0,
          lesson_ImageUrl:
            'https://cdn.skillacademy.com/images/updated-abc123.jpg',
          lesson_videoUrl: null,
        },
      },
      video: {
        summary: 'ตัวอย่าง: บทเรียนแบบวิดีโอ',
        value: {
          lesson_title: 'updated video title',
          lesson_description:
            'Updated description about watching how variables work in practice',
          chapter_id: 1,
          lesson_type: 'video',
          orderIndex: 1,
          lesson_ImageUrl:
            'https://cdn.skillacademy.com/images/updated-def456.jpg',
          lesson_videoUrl:
            'https://cdn.skillacademy.com/videos/updated-abc123.mp4',
        },
      },
      quiz: {
        summary: 'ตัวอย่าง: บทเรียนแบบแบบทดสอบ',
        value: {
          lesson_title: 'updated quiz title',
          lesson_description:
            'Updated description about testing your knowledge on variable concepts',
          chapter_id: 1,
          lesson_type: 'quiz',
          orderIndex: 2,
          lesson_ImageUrl:
            'https://cdn.skillacademy.com/images/updated-ghi789.jpg',
          lesson_videoUrl: null,
        },
      },
      checkpoint: {
        summary: 'ตัวอย่าง: บทเรียนแบบจุดตรวจสอบ',
        value: {
          lesson_title: 'updated checkpoint title',
          lesson_description:
            'Updated description about quick check on variable concepts',
          chapter_id: 1,
          lesson_type: 'checkpoint',
          orderIndex: 3,
          lesson_ImageUrl:
            'https://cdn.skillacademy.com/images/updated-jkl012.jpg',
          lesson_videoUrl: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: 'Lesson updated successfully',
    type: LessonResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLessonDto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบบทเรียนตาม ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Lesson deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.lessonsService.remove(id);
  }

  @Post('reorder')
  @ApiOperation({ summary: 'จัดลำดับบทเรียนภายในบท' })
  @ApiBody({
    type: ReorderLessonsDto,
    examples: {
      reorder: {
        value: {
          chapterId: 1,
          lessonIds: [3, 1, 2, 4],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Lessons reordered successfully',
    type: LessonResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  reorder(@Body() body: ReorderLessonsDto): Promise<LessonResponseDto[]> {
    return this.lessonsService.reorder(body.chapterId, body.lessonIds);
  }
}
