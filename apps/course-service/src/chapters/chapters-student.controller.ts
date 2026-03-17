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
import { ChaptersService } from './chapters.service';
import { ChapterResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Student | Chapter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/chapter')
export class ChaptersStudentController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  @ApiOperation({ summary: 'ดึงบททั้งหมดสำหรับระดับ' })
  @ApiQuery({
    name: 'level_id',
    type: Number,
    required: true,
    description: 'ID of the level to fetch chapters for',
  })
  @ApiResponse({
    status: 200,
    description: 'List of chapters for the specified level',
    type: ChapterResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findByLevel(
    @Query('level_id', ParseIntPipe) levelId: number,
  ): Promise<ChapterResponseDto[]> {
    return this.chaptersService.findByLevelStudent(levelId);
  }

  @Get('all')
  @ApiOperation({ summary: 'ดึงบททั้งหมด' })
  @ApiResponse({
    status: 200,
    description: 'List of all chapters',
    type: ChapterResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(): Promise<ChapterResponseDto[]> {
    return this.chaptersService.findAllStudent();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดึงบทตาม ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Chapter found',
    type: ChapterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ChapterResponseDto> {
    return this.chaptersService.findOneStudent(id);
  }
}
