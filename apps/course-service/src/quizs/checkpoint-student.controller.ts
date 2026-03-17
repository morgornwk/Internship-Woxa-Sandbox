import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums';
import { CurrentUserId } from '../notifications/decorators/current-user-id.decorator';

@ApiTags('Student | Quiz Checkpoint')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/checkpoint')
export class CheckpointStudentController {
  constructor(private readonly quizService: QuizService) {}

  @Get(':lessonId')
  @ApiOperation({ summary: 'ดึง checkpoint ตาม lesson ID' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Checkpoint retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findCheckpointByLessonId(
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ) {
    const checkpoint =
      await this.quizService.findOneCheckpointByLessonId(lessonId);
    return { ...checkpoint, score: checkpoint.checkpointScore };
  }

  @Get(':lessonId/status')
  @ApiOperation({
    summary: 'ดึง checkpoint พร้อม Student_Progress ตาม lesson ID',
  })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Checkpoints retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findCheckpointsByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUserId() userId: string,
  ) {
    return this.quizService.findCheckpointsByLesson(lessonId, userId);
  }

  @Post(':checkpointId/check')
  @ApiOperation({ summary: 'ตรวจคำตอบ checkpoint ตาม id' })
  @ApiParam({
    name: 'checkpointId',
    type: Number,
    description: 'Checkpoint ID (ไม่ใช่ lessonId)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        answer: {
          description:
            'User answer (string | boolean | number | array | object). Must match stored checkpoint answer shape.',
        },
      },
      required: ['answer'],
    },
    examples: {
      example: {
        summary: 'ตัวอย่าง',
        value: { answer: '2' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Checkpoint answer checked successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid answer format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  @ApiResponse({
    status: 409,
    description:
      'This checkpoint has already been attempted and cannot be answered again',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  checkCheckpoint(
    @Param('checkpointId', ParseIntPipe) checkpointId: number,
    @CurrentUserId() userId: string,
    @Body('answer') answer: unknown,
  ) {
    return this.quizService.checkCheckpointAnswer(checkpointId, userId, answer);
  }

  @Post(':checkpointId/skip')
  @ApiOperation({ summary: 'ข้าม checkpoint และบันทึกสถานะเป็น skipped' })
  @ApiParam({
    name: 'checkpointId',
    type: Number,
    description: 'checkpointId (ไม่ใช่ lessonId)',
  })
  @ApiResponse({ status: 200, description: 'Checkpoint skipped successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  @ApiResponse({
    status: 409,
    description:
      'This checkpoint has already been attempted and cannot be skipped',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  skipCheckpoint(
    @Param('checkpointId', ParseIntPipe) checkpointId: number,
    @CurrentUserId() userId: string,
  ) {
    return this.quizService.skipCheckpoint(checkpointId, userId);
  }
}
