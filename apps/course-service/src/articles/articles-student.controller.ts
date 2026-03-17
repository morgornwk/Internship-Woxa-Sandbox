import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Student | Article')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/article')
export class ArticlesStudentController {
  constructor(private readonly svc: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'ดึงบทความทั้งหมด' })
  @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Articles not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiOkResponse({ type: ArticleResponseDto, isArray: true })
  async findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดึงบทความตาม ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiOkResponse({ type: ArticleResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Get('lesson/:id')
  @ApiOperation({ summary: 'ดึงบทความตาม lesson ID' })
  @ApiParam({ name: 'id', description: 'Lesson id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiOkResponse({ type: ArticleResponseDto, isArray: true })
  async findByLesson(@Param('id', ParseIntPipe) lessonId: number) {
    return this.svc.findByLesson(lessonId);
  }
}
