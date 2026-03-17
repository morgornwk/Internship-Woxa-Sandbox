import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RewardService } from './reward.service';
import { CurrentUserId, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@common/enums';
import { Reward } from './entities/rewards.entity';

@Controller('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get('getAllStudentRewards')
  @ApiOperation({ summary: 'ดึงข้อมูล reward ทั้งหมด' })
  @ApiResponse({ status: 200, description: 'List of rewards' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getAllReward() {
    return this.rewardService.getAllReward();
  }

  @Get(':reward_id/rewardDetail')
  @ApiOperation({
    summary: 'Get reward detail by id',
    description: 'Retrieve reward information by reward id',
  })
  @ApiParam({
    name: 'reward_id',
    type: Number,
    description: 'Reward ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Reward detail retrieved successfully',
    type: Reward,
  })
  @ApiBadRequestResponse({
    description: 'Invalid reward id',
  })
  @ApiNotFoundResponse({
    description: 'Reward not found',
  })
  getRewardDetail(
    @Param('reward_id', ParseIntPipe) reward_id: number,
    @CurrentUserId() userId: string,
  ) {
    return this.rewardService.getDetailReward(userId, reward_id);
  }

  @Post(':reward_id/redeem')
  @ApiOperation({ summary: 'แลก reward โดยใช้แต้มของ user' })
  @ApiResponse({ status: 200, description: 'Reward redeemed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiParam({
    name: 'reward_id',
    type: Number,
  })
  redeemReward(
    @CurrentUserId() userId: string,
    @Param('reward_id', ParseIntPipe) reward_id: number,
  ) {
    return this.rewardService.redeemReward(userId, reward_id);
  }

  @Get('getReedeem')
  @ApiOperation({ summary: 'ดึงข้อมูล reward ที่ user แลกไปแล้ว' })
  @ApiResponse({ status: 200, description: 'List of redeemed rewards' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getRedeem(@CurrentUserId() userId: string) {
    return this.rewardService.getRedeem(userId);
  }

  @Get('userxp')
  @ApiOperation({ summary: 'ดึง XP ทั้งหมดของผู้ใช้' })
  @ApiResponse({ status: 200, description: 'Current user XP' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiOperation({ summary: 'Get total XP for current user' })
  getUserTotalXp(@CurrentUserId() userId: string) {
    return this.rewardService.getUserTotalXp(userId);
  }

  @Get('countCupon')
  @ApiOperation({ summary: 'ดึงจำนวน cupon ทั้งหมดที่ user ยังไม่ได้ใช้' })
  @ApiResponse({ status: 200, description: 'Current user cupon count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  getCouponCount(@CurrentUserId() userId: string) {
    return this.rewardService.getRedeemCount(userId);
  }
}
