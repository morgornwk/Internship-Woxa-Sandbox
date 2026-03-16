import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';

import { AiQuizService } from './ai-quiz.service';
import { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';

@ApiTags('Admin | Ai Analyzer - Quiz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/ai-quiz')
export class AiQuizAdminController {
  constructor(private readonly aiQuizService: AiQuizService) {}

  @Post(':lessonId/generate')
  @ApiOperation({ summary: 'Generate AI quiz from lesson content' })
  @ApiParam({ name: 'lessonId', type: Number })
  @ApiBody({
    type: GenerateAiQuizDto,
    description: 'Optional parameters to influence quiz generation',
    examples: {
      multiple_choice: {
        summary: 'ตัวอย่าง: สร้าง Quiz แบบเลือกตอบ (TH, medium)',
        value: {
          language: 'th',
          difficulty: 'medium',
          quiz_type: 'multiple_choice',
          admin: 'ช่วยสร้างข้อสอบแบบเลือกตอบ 4 ตัวเลือก เน้นความเข้าใจจากเนื้อหา',
        },
      },
      true_false: {
        summary: 'ตัวอย่าง: สร้าง Quiz แบบถูก/ผิด (TH, easy)',
        value: {
          language: 'th',
          difficulty: 'easy',
          quiz_type: 'true_false',
          admin: 'ช่วยสร้างข้อสอบแบบถูก/ผิด โดยให้ตัวเลือกเป็น True/False',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'AI quiz generation created' })
  @ApiResponse({ status: 400, description: 'Invalid lesson ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 429, description: 'OpenAI quota exceeded' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  generateFromLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Body() body?: GenerateAiQuizDto,
  ) {
    return this.aiQuizService.generateQuizFromLesson(lessonId, body);
  }

  @Post(':aiQuizId/approve')
  @ApiOperation({ summary: 'Approve AI quiz and save to quizs table' })
  @ApiParam({ name: 'aiQuizId', type: Number })
  @ApiResponse({ status: 201, description: 'Quiz saved and AI quiz marked approved' })
  @ApiResponse({ status: 400, description: 'Invalid AI quiz ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'AI quiz not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  approve(@Param('aiQuizId', ParseIntPipe) aiQuizId: number) {
    return this.aiQuizService.approveAiQuiz(aiQuizId);
  }
}