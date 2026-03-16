import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums';
import { CurrentUserId } from '../notifications/decorators/current-user-id.decorator';

@ApiTags('Student | Quiz ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/quiz')
export class QuizStudentController {
  constructor(private readonly quizService: QuizService) { }

  @Get()
  @ApiOperation({ summary: 'ดึงรายการ quiz ทั้งหมด' })
  @ApiResponse({ status: 200, description: 'List of quizzes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No quizzes found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAllQuizzes() {
    return this.quizService.findAllQuizs();
  }

  @Get(':lessonId')
  @ApiOperation({ summary: 'ดึง quiz พร้อมสถานะตาม lesson ID ' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({ status: 200, description: 'Quiz retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid lesson ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 409, description: 'This quiz has already been attempted and cannot be answered again' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findOneQuizByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUserId() userId: string,
  ) {
    return this.quizService.getQuizWithStatus(lessonId, userId);
  }

  @Post(':lessonId/check')
  @ApiOperation({ summary: 'ตรวจคำตอบ quiz และบันทึกผล' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        answer: {
          description: 'User answer (string | boolean | number | array | object). Must match stored quiz answer shape.',
        },
      },
      required: ['answer'],
    },
    examples: {
      multiple_choice: {
        summary: 'ตัวอย่าง: เลือกตอบ',
        value: { answer: '2' },
      },
      true_false: {
        summary: 'ตัวอย่าง: ถูก/ผิด',
        value: { answer: 'True' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Check answer and save successfully' })
  @ApiResponse({ status: 400, description: 'Invalid answer format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  checkQuizs(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUserId() userId: string,
    @Body('answer') answer: unknown,
  ) {
    return this.quizService.checkAndSaveAnswer(lessonId, userId, answer);
  }

  @Post(':lessonId/skip')
  @ApiOperation({ summary: 'ข้าม quiz และบันทึกสถานะเป็น completed' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({ status: 200, description: 'Quiz skipped successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 409, description: 'This quiz has already been attempted and cannot be skipped' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  skipQuiz(@Param('lessonId', ParseIntPipe) lessonId: number, @CurrentUserId() userId: string) {
    return this.quizService.skipQuiz(lessonId, userId);
  }
}