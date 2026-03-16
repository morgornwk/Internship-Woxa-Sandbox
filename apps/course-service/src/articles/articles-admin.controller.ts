import { Body, Controller, Post, Get, Param, Patch, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import { UpdateArticleDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Admin | Article')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin/article')
export class ArticlesAdminController {
    constructor(private readonly svc: ArticlesService) { }

    @Post()
    @ApiOperation({ summary: 'สร้างบทความใหม่' })
    @ApiBody({
        type: CreateArticleDto,
        examples: {
            example1: {
                summary: 'Create article example',
                value: {
                    lesson_id: 1,
                    article_content: [
                        {
                            imageUrl: 'https://cdn.yoursite.com/images/abc.jpg',
                            article: 'Another article block',
                            order: 1,
                        },
                        {
                            imageUrl: 'https://cdn.yoursite.com/images/xyz.jpg',
                            article: 'Another article block',
                            order: 2,
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Article created successfully', type: ArticleResponseDto })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Lesson not found' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async create(@Body() body: CreateArticleDto) {
        return this.svc.create(body);
    }

    @Get()
    @ApiOperation({ summary: 'ดึงบทความทั้งหมดพร้อมตัวกรองที่เลือกได้' })
    @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async findAll(): Promise<ArticleResponseDto[]> {
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

    @Patch(':id')
    @ApiOperation({ summary: 'แก้ไขบทความตาม ID' })
    @ApiParam({ name: 'id', type: 'number' })
    @ApiBody({ type: UpdateArticleDto })
    @ApiResponse({ status: 200, description: 'Article updated successfully', type: ArticleResponseDto })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Article not found' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateArticleDto) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'ลบบทความตาม ID' })
    @ApiParam({ name: 'id', type: 'number' })
    @ApiResponse({ status: 200, description: 'Article deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Article not found' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async remove(@Param('id', ParseIntPipe) id: number,) {
        return this.svc.remove(id);
    }
}