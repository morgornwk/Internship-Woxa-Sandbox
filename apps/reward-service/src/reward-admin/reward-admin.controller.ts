import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { RewardAdminService } from './reward-admin.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRewardAdminResponseDto } from './dto/create-reward-response-admin.dto';
import { JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';
import { CreateRewardAdminDto } from './dto/create-reward-admin.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { UpdateRewardAdminDto } from './dto/update-reward-admin.dto';

@ApiTags('Reward Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('admin')
export class AdminController {
  constructor(private readonly RewardAdminService: RewardAdminService) {}

  @Get('/reward/getAllAdminReward')
  @ApiOperation({ summary: 'Get reward admin ทั้งหมด' })
  @ApiResponse({ status: 200, description: 'List of rewards' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Rewards not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  GetAllReward() {
    return this.RewardAdminService.getAllReward();
  }

  @Get('/reward/:reward_id/adminRewardDetail')
  @ApiOperation({ summary: 'Get admin reward detail by reward_id' })
  @ApiParam({
    name: 'reward_id',
    type: Number,
    required: true,
    description: 'Reward ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Reward detail retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid reward id' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getRewardDetail(@Param('reward_id', ParseIntPipe) reward_id: number) {
    return this.RewardAdminService.getRewardDetail(reward_id);
  }

  @Post('/reward/create')
  @ApiOperation({
    summary: 'สร้าง reward โดยต้องกรอกข้อมูลให้ครบ (ไม่รับ 0 บาง field)',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'image',
        'name',
        'required_points',
        'description',
        'redeem_start_date',
        'redeem_end_date',
        'is_active',
      ],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        required_points: { type: 'number' },
        redeem_start_date: { type: 'string', format: 'date-time' },
        redeem_end_date: { type: 'string', format: 'date-time' },
        limit_per_user: { type: 'number' },
        total_limit: { type: 'number' },
        is_active: { type: 'boolean' },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiCreatedResponse({ type: CreateRewardAdminResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createReward(
    @UploadedFile() file: Express.Multer.File,
    @Body() createRewardDto: CreateRewardAdminDto,
  ) {
    const imgUrl = await this.RewardAdminService.uploadRewardImage(file);

    const rewardCreated = await this.RewardAdminService.createReward(
      createRewardDto,
      imgUrl,
    );

    return rewardCreated;
  }

  @Patch('reward/update/:id')
  @ApiOperation({ summary: 'แก้ไขข้อมูลของ reward' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 204, description: 'Reward updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateReward(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateRewardAdminDto,
  ) {
    return this.RewardAdminService.updateReward(id, dto, file);
  }

  @Delete('reward/delete/:id')
  @ApiOperation({ summary: 'Delete reward by reward_id (Soft delete)' })
  @ApiResponse({ status: 204, description: 'Reward deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async deleteReward(@Param('id', ParseIntPipe) id: number) {
    const removeReward = await this.RewardAdminService.removeRewardById(id);

    return removeReward;
  }
}
