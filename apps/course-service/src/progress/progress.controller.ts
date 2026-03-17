import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth';
import { CurrentUserId } from '../notifications/decorators/current-user-id.decorator';
import { LessonProgressResponseDto } from './dto/lesson-progress-response.dto';
import { SkipLessonResponseDto } from './dto/skip-lesson-response.dto';
import { UpsertLessonProgressDto } from './dto/upsert-lesson-progress.dto';
import { ChapterProgressDto } from './dto/chapter-progress.dto';
import { ChapterRoadmapDto } from './dto/chapter-roadmap.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('lessons')
  @ApiOperation({ summary: 'ดึงข้อมูลความคืบหน้าของบทเรียนทั้งหมด' })
  @ApiOkResponse({ type: [LessonProgressResponseDto] })
  @ApiResponse({
    status: 200,
    description: 'Lesson progress retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No progress found for user' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getAllLessonProgress(
    @CurrentUserId() userId: string,
  ): Promise<LessonProgressResponseDto[]> {
    return this.progressService.getAllLessonProgress(userId);
  }

  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'ดึงข้อมูลความคืบหน้าของบทเรียน' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiOkResponse({
    type: LessonProgressResponseDto,
    description: 'Lesson progress retrieved successfully',
  })
  @ApiResponse({
    status: 200,
    description: 'Lesson progress retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getLessonProgress(
    @CurrentUserId() userId: string,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ): Promise<LessonProgressResponseDto | null> {
    return this.progressService.getLessonProgress(userId, lessonId);
  }

  @Put('lessons/:lessonId')
  @ApiOperation({ summary: 'เพิ่มหรือแก้ไขความคืบหน้าของบทเรียน' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiOkResponse({ type: LessonProgressResponseDto })
  @ApiResponse({
    status: 200,
    description: 'Lesson progress upserted successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  upsertLessonProgress(
    @CurrentUserId() userId: string,
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() dto: UpsertLessonProgressDto,
  ): Promise<LessonProgressResponseDto> {
    return this.progressService.upsertLessonProgress(userId, lessonId, dto);
  }

  @Post('lessons/:lessonId/skip')
  @ApiOperation({ summary: 'ข้ามบทเรียนและปลดล็อกบทเรียนถัดไป' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiOkResponse({ type: SkipLessonResponseDto })
  @ApiResponse({
    status: 200,
    description: 'Lesson skipped and next lesson unlocked successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  skipLesson(
    @CurrentUserId() userId: string,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ): Promise<SkipLessonResponseDto> {
    return this.progressService.skipLessonAndUnlockNext(userId, lessonId);
  }

  @Get('chapters/:chapterId')
  @ApiOperation({ summary: 'ดึงข้อมูลความคืบหน้าของบทเรียน' })
  @ApiParam({ name: 'chapterId', type: Number })
  @ApiOkResponse({ type: ChapterProgressDto })
  @ApiResponse({
    status: 200,
    description: 'Chapter progress retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getChapterProgress(
    @CurrentUserId() userId: string,
    @Param('chapterId', ParseIntPipe) chapterId: number,
  ): Promise<ChapterProgressDto> {
    return this.progressService.getChapterProgress(userId, chapterId);
  }

  @Get('chapters/:chapterId/roadmap')
  @ApiOperation({
    summary:
      'ดึงแผนที่เส้นทางของบทเรียนพร้อมสถานะของแต่ละรายการ Completed/Current/Locked และสถานะ Streak',
    description:
      'คืนข้อมูล roadmap ของบทเรียนพร้อมสถานะของแต่ละบทเรียน และสถานะ Streak ปัจจุบันของผู้ใช้',
  })
  @ApiParam({ name: 'chapterId', type: Number, example: 1 })
  @ApiOkResponse({
    type: ChapterRoadmapDto,
    description: 'ดึงข้อมูล roadmap สำเร็จ',
    examples: {
      with_active_streak: {
        summary: 'มี Streak ที่กำลังทำอยู่',
        value: {
          chapterId: 1,
          chapterTitle: 'บทเรียนพื้นฐาน',
          progressPercent: 65,
          items: [
            {
              lessonId: 1,
              lessonTitle: 'บทนำ',
              lessonType: 'video',
              isPublished: true,
              status: 'COMPLETED',
              progressPercent: 100,
              positionSeconds: 300,
              durationSeconds: 300,
              completedAt: '2025-01-10T10:00:00.000Z',
              orderIndex: 1,
            },
            {
              lessonId: 2,
              lessonTitle: 'เนื้อหาหลัก',
              lessonType: 'video',
              isPublished: true,
              status: 'IN_PROGRESS',
              progressPercent: 30,
              positionSeconds: 90,
              durationSeconds: 300,
              completedAt: null,
              orderIndex: 2,
            },
            {
              lessonId: 3,
              lessonTitle: 'แบบฝึกหัด',
              lessonType: 'quiz',
              isPublished: true,
              status: 'LOCKED',
              progressPercent: 0,
              positionSeconds: null,
              durationSeconds: null,
              completedAt: null,
              orderIndex: 3,
            },
          ],
          nextAvailableLessonId: 2,
          checkpointUnlocked: null,
          streakStatus: 'COMPLETE',
          isReward: true,
        },
      },
      without_streak: {
        summary: 'ไม่มี Streak',
        value: {
          chapterId: 2,
          chapterTitle: 'บทเรียนขั้นสูง',
          progressPercent: 0,
          items: [
            {
              lessonId: 4,
              lessonTitle: 'เริ่มต้น',
              lessonType: 'video',
              isPublished: true,
              status: 'LOCKED',
              progressPercent: 0,
              positionSeconds: null,
              durationSeconds: null,
              completedAt: null,
              orderIndex: 1,
            },
          ],
          nextAvailableLessonId: null,
          checkpointUnlocked: null,
          streakStatus: 'IN_PROGRESS',
          isReward: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Chapter roadmap retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getChapterRoadmap(
    @CurrentUserId() userId: string,
    @Param('chapterId', ParseIntPipe) chapterId: number,
  ): Promise<ChapterRoadmapDto> {
    return this.progressService.getChapterRoadmap(userId, chapterId);
  }
}
