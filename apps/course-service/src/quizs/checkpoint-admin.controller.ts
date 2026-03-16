import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { CreateCheckpointDto, UpdateCheckpointDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums';
import { CurrentUserId } from '../notifications/decorators/current-user-id.decorator';

@ApiTags('Admin | Quiz Checkpoint')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/checkpoint')
export class CheckpointAdminController {
    constructor(private readonly quizService: QuizService) { }

    @Post()
    @ApiOperation({ summary: 'สร้างหรืออัปเดต checkpoint สำหรับบทเรียน (1 บทเรียน = 1 checkpoint)' })
    @ApiBody({
        type: CreateCheckpointDto,
        examples: {
            multiple_choice: {
                summary: 'ตัวอย่าง: Checkpoint แบบเลือกตอบ',
                value: {
                    lesson_id: 1,
                    checkpoint_type: 'multiple_choice',
                    checkpoint_questions: '1 + 1 เท่ากับเท่าไหร่?',
                    checkpoint_option: ['1', '2', '3'],
                    checkpoint_answer: '2',
                    checkpoint_explanation: '1 + 1 = 2',
                },
            },
            true_false: {
                summary: 'ตัวอย่าง: Checkpoint แบบถูก/ผิด',
                value: {
                    lesson_id: 2,
                    checkpoint_type: 'true_false',
                    checkpoint_questions: 'Node.js คือภาษาโปรแกรมใช่หรือไม่?',
                    checkpoint_option: ['True', 'False'],
                    checkpoint_answer: 'False',
                    checkpoint_explanation: 'Node.js เป็น Runtime environment สำหรับรัน JavaScript ไม่ใช่ภาษาโปรแกรม',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Checkpoint created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Lesson not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async createCheckpoint(@Body() dto: CreateCheckpointDto) {
        const checkpoint = await this.quizService.createCheckpoint(dto);
        return {
            ...checkpoint,
            score: checkpoint.checkpointScore,
        };
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
                    description: 'User answer (string | boolean | number | array | object). Must match stored checkpoint answer shape.',
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
    @ApiResponse({ status: 200, description: 'Checkpoint answer checked successfully' })
    @ApiResponse({ status: 400, description: 'Invalid answer format' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Checkpoint not found' })
    @ApiResponse({ status: 409, description: 'This checkpoint has already been attempted and cannot be answered again' })
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
    @ApiResponse({ status: 409, description: 'This checkpoint has already been attempted and cannot be skipped' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    skipCheckpoint(
        @Param('checkpointId', ParseIntPipe) checkpointId: number,
        @CurrentUserId() userId: string,
    ) {
        return this.quizService.skipCheckpoint(checkpointId, userId);
    }

    @Get(':lessonId')
    @ApiOperation({ summary: 'ดึง checkpoint ตาม lesson ID' })
    @ApiParam({ name: 'lessonId', type: Number })
    @ApiResponse({ status: 200, description: 'Checkpoint retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Checkpoint not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async findCheckpointByLessonId(@Param('lessonId', ParseIntPipe) lessonId: number) {
        const checkpoint = await this.quizService.findOneCheckpointByLessonId(lessonId);
        return { ...checkpoint, score: checkpoint.checkpointScore };
    }

    @Get(':lessonId/status')
    @ApiOperation({ summary: 'ดึง checkpoint พร้อม Student_Progress ตาม lesson ID' })
    @ApiParam({ name: 'lessonId', type: Number })
    @ApiResponse({ status: 200, description: 'Checkpoints retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Lesson not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    findCheckpointsByLesson(
        @Param('lessonId', ParseIntPipe) lessonId: number,
        @CurrentUserId() userId: string,
    ) {
        return this.quizService.findCheckpointsByLesson(lessonId, userId);
    }

    @Patch(':lessonId')
    @ApiOperation({ summary: 'อัปเดต checkpoint ตาม lesson ID' })
    @ApiParam({ name: 'lessonId', type: Number })
    @ApiBody({
        type: UpdateCheckpointDto,
        examples: {
            multiple_choice: {
                summary: 'ตัวอย่าง: อัปเดต Checkpoint แบบเลือกตอบ',
                value: {
                    checkpoint_type: 'multiple_choice',
                    checkpoint_questions: '1 + 1 เท่ากับเท่าไหร่?',
                    checkpoint_option: ['1', '2', '3'],
                    checkpoint_answer: '2',
                    checkpoint_explanation: '1 + 1 = 2',
                },
            },
            true_false: {
                summary: 'ตัวอย่าง: อัปเดต Checkpoint แบบถูก/ผิด',
                value: {
                    checkpoint_type: 'true_false',
                    checkpoint_questions: 'Node.js คือภาษาโปรแกรมใช่หรือไม่?',
                    checkpoint_option: ['True', 'False'],
                    checkpoint_answer: 'False',
                    checkpoint_explanation: 'Node.js เป็น Runtime environment สำหรับรัน JavaScript ไม่ใช่ภาษาโปรแกรม',
                },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Checkpoint updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Checkpoint not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async updateCheckpoint(
        @Param('lessonId', ParseIntPipe) lessonId: number,
        @Body() dto: Partial<UpdateCheckpointDto>,
    ) {
        const checkpoint = await this.quizService.updateCheckpointByLessonId(lessonId, dto);
        return { ...checkpoint, score: checkpoint.checkpointScore };
    }

    @Delete(':lessonId')
    @ApiOperation({ summary: 'ลบ checkpoint ตาม lesson ID' })
    @ApiParam({ name: 'lessonId', type: Number })
    @ApiResponse({ status: 204, description: 'Checkpoint deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Checkpoint not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    removeCheckpoint(@Param('lessonId', ParseIntPipe) lessonId: number) {
        return this.quizService.removeCheckpointByLessonId(lessonId);
    }
}