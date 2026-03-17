import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { CreateQuizsDto, UpdateQuizsDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums';
import { CurrentUserId } from '../notifications/decorators/current-user-id.decorator';

@ApiTags('Admin | Quiz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/quiz')
export class QuizAdminController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @ApiOperation({
    summary: 'สร้างหรืออัปเดต quiz สำหรับบทเรียน (1 บทเรียน = 1 ควิซ)',
  })
  @ApiBody({
    type: CreateQuizsDto,
    examples: {
      multiple_choice: {
        summary: 'ตัวอย่าง: Quiz แบบเลือกตอบ (MC)',
        value: {
          lesson_id: 1,
          quizs_type: 'multiple_choice',
          quizs_questions: 'TypeScript คืออะไร?',
          quizs_option: [
            'Superset ของ JavaScript',
            'ชื่อกาแฟ',
            'ระบบปฏิบัติการ',
          ],
          quizs_answer: 'Superset ของ JavaScript',
          quizs_explanation:
            'TypeScript เป็นภาษาที่สร้างครอบ JS เพื่อเพิ่มระบบ Type',
        },
      },
      true_false: {
        summary: 'ตัวอย่าง: Quiz แบบถูก/ผิด (TF)',
        value: {
          lesson_id: 2,
          quizs_type: 'true_false',
          quizs_questions: 'Node.js คือภาษาโปรแกรมใช่หรือไม่?',
          quizs_option: ['True', 'False'],
          quizs_answer: 'False',
          quizs_explanation: 'Node.js เป็น Runtime environment สำหรับรัน JS',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Quiz created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  createQuiz(@Body() dto: CreateQuizsDto) {
    return this.quizService.createQuizs(dto);
  }

  @Post(':lessonId/check')
  @ApiOperation({ summary: 'ตรวจคำตอบ quiz และบันทึกผล' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        answer: {
          description:
            'User answer (string | boolean | number | array | object). Must match stored quiz answer shape.',
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
  @ApiResponse({
    status: 200,
    description: 'Check answer and save successfully',
  })
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
  @ApiResponse({
    status: 409,
    description: 'This quiz has already been attempted and cannot be skipped',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  skipQuiz(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUserId() userId: string,
  ) {
    return this.quizService.skipQuiz(lessonId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'ดึงรายการ quiz ทั้งหมด' })
  @ApiResponse({
    status: 200,
    description: 'List of quizzes retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No quizzes found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAllQuizzes() {
    return this.quizService.findAllQuizs();
  }

  @Get(':lessonId')
  @ApiOperation({ summary: 'ดึง quiz ตาม lesson ID' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({ status: 200, description: 'Quiz retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findQuizByLessonAdmin(@Param('lessonId', ParseIntPipe) lessonId: number) {
    return this.quizService.findOneQuizsByLesson(lessonId);
  }

  @Get(':lessonId/status')
  @ApiOperation({ summary: 'ดึง quiz พร้อมสถานะตาม lesson ID ทั้งหมด' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({ status: 200, description: 'Quiz retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({
    status: 409,
    description:
      'This quiz has already been attempted and cannot be answered again',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findOneQuizByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUserId() userId: string,
  ) {
    return this.quizService.getQuizWithStatus(lessonId, userId);
  }

  @Patch(':lessonId')
  @ApiOperation({ summary: 'อัปเดต quiz ตาม lesson ID' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiBody({
    type: UpdateQuizsDto,
    examples: {
      multiple_choice: {
        summary: 'ตัวอย่าง: อัปเดต Quiz แบบเลือกตอบ (MC)',
        value: {
          quizs_type: 'multiple_choice',
          quizs_questions: 'TypeScript คืออะไร?',
          quizs_option: [
            'Superset ของ JavaScript',
            'ชื่อกาแฟ',
            'ระบบปฏิบัติการ',
          ],
          quizs_answer: 'Superset ของ JavaScript',
          quizs_explanation:
            'TypeScript เป็นภาษาที่สร้างครอบ JS เพื่อเพิ่มระบบ Type',
        },
      },
      true_false: {
        summary: 'ตัวอย่าง: อัปเดต Quiz แบบถูก/ผิด (TF)',
        value: {
          quizs_type: 'true_false',
          quizs_questions: 'Node.js คือภาษาโปรแกรมใช่หรือไม่?',
          quizs_option: ['True', 'False'],
          quizs_answer: 'False',
          quizs_explanation: 'Node.js เป็น Runtime environment สำหรับรัน JS',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Quiz updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  updateQuiz(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() dto: Partial<UpdateQuizsDto>,
  ) {
    return this.quizService.updateQuizs(lessonId, dto);
  }

  @Delete(':lessonId')
  @ApiOperation({ summary: 'ลบ quiz ตาม lesson ID' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiResponse({ status: 204, description: 'Quiz deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  removeQuiz(@Param('lessonId', ParseIntPipe) lessonId: number) {
    return this.quizService.removeQuizs(lessonId);
  }
}
