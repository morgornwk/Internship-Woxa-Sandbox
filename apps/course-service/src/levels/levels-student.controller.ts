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
import { LevelsService } from './levels.service';
import { LevelResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@auth';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('Student | Level')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student/level')
export class LevelsStudentController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  @ApiOperation({ summary: 'ดึงระดับทั้งหมดสำหรับคอร์ส' })
  @ApiQuery({ name: 'course_id', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of levels for the specified course',
    type: LevelResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Invalid course ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findByCourse(
    @Query('course_id', ParseIntPipe) course_id: number,
  ): Promise<LevelResponseDto[]> {
    return this.levelsService.findByCourse(course_id);
  }

  @Get('all')
  @ApiOperation({ summary: 'ดึงระดับทั้งหมด' })
  @ApiResponse({
    status: 200,
    description: 'List of all levels',
    type: LevelResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Levels not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  findAll(): Promise<LevelResponseDto[]> {
    return this.levelsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดึงระดับตาม ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Level found',
    type: LevelResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid level ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Level not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<LevelResponseDto> {
    return this.levelsService.findOne(id);
  }
}
