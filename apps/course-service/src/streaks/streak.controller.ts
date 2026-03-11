import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth';
import { CurrentUserId } from './decorators/current-user-id.decorator';
import { StreakService } from './streak.service';
import { StreakResponseDto } from './dto/streak-response.dto';
// import { TestBumpDto } from './dto/test-bump.dto';
// import { getStreakColor } from './dto/streak-color.dto';

@ApiTags('Streak')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('streaks')
export class StreakController {
  constructor(private readonly streakService: StreakService) { }

  @Get()
  @ApiOperation({ summary: 'ดึงข้อมูล streak ปัจจุบันของผู้ใช้' })
  @ApiResponse({
    status: 200,
    description: 'ดึงข้อมูล streak สำเร็จ',
    examples: {
      'new_user': {
        summary: 'ผู้ใช้ใหม่ (ยังไม่มี streak)',
        value: {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletedAt: null,
          color: null,
          isReward: false,
          isFlameOn: false
        }
      },
      'beginner': {
        summary: 'ผู้เริ่มต้น (1-2 วัน)',
        value: {
          currentStreak: 2,
          longestStreak: 2,
          lastCompletedAt: '2025-01-02T10:30:00.000Z',
          color: null,
          isReward: true,
          isFlameOn: true
        }
      },
      'intermediate': {
        summary: 'ผู้ใช้ระดับกลาง (3-9 วัน)',
        value: {
          currentStreak: 7,
          longestStreak: 7,
          lastCompletedAt: '2025-01-07T09:15:00.000Z',
          color: 'yellow',
          isReward: true,
          isFlameOn: true
        }
      },
      'advanced': {
        summary: 'ผู้ใช้ขั้นสูง (10-29 วัน)',
        value: {
          currentStreak: 12,
          longestStreak: 12,
          lastCompletedAt: '2025-01-12T14:20:00.000Z',
          color: 'orange',
          isReward: true,
          isFlameOn: true
        }
      },
      'expert': {
        summary: 'ผู้เชี่ยวชาญ (30-99 วัน)',
        value: {
          currentStreak: 45,
          longestStreak: 45,
          lastCompletedAt: '2025-01-12T08:45:00.000Z',
          color: 'red',
          isReward: true,
          isFlameOn: true
        }
      },
      'master': {
        summary: 'ผู้เชี่ยวชาญสูงสุด 100+ วัน',
        value: {
          currentStreak: 105,
          longestStreak: 105,
          lastCompletedAt: '2025-01-12T11:30:00.000Z',
          color: 'pink',
          isReward: true,
          isFlameOn: true
        }
      },
      'legend': {
        summary: 'ระดับตำนาน (200+ วัน)',
        value: {
          currentStreak: 250,
          longestStreak: 250,
          lastCompletedAt: '2025-01-12T07:00:00.000Z',
          color: 'purple',
          isReward: true,
          isFlameOn: true
        }
      },
      'flame_off': {
        summary: 'ขาดวัน (ไฟดับ) แต่เลขสะสมยังอยู่',
        value: {
          currentStreak: 15,
          longestStreak: 15,
          lastCompletedAt: '2025-01-05T10:00:00.000Z',
          color: 'orange',
          isReward: false,
          isFlameOn: false
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Get streak successfully' })
  @ApiResponse({ status: 404, description: 'Streak not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getStreak(@CurrentUserId() userId: string): Promise<StreakResponseDto> {
    const { streak, color, isReward, isFlameOn } = await this.streakService.getStreak(userId);
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastCompletedAt: streak.lastCompletedAt,
      color,
      isReward,
      isFlameOn,
    };
  }

  @Post('reward/shown')
  @ApiOperation({
    summary: 'ทำเครื่องหมายโมดอลรางวัลตามที่แสดง',
    description: 'เรียก endpoint นี้เมื่อโมดอลรางวัลถูกแสดงแล้ว เพื่อให้ระบบไม่แสดงโมดอลซ้ำในวันเดียวกัน'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {},
    },
  })
  @ApiResponse({ status: 200, description: 'Success | Reward modal marked as shown' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Streak not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async markRewardShown(@CurrentUserId() userId: string): Promise<{ message: string }> {
    await this.streakService.markRewardShown(userId);
    return { message: 'Reward modal marked as shown' };
  }

  @Post('debug/bump')
  @ApiOperation({ summary: '[DEBUG] Bump streak with detailed log' })
  @ApiBody({ schema: { type: 'object', properties: { date: { type: 'string', example: '2025-01-01T16:50:00.000Z' } } } })
  async debugBump(
    @CurrentUserId() userId: string,
    @Body() body: { date: string },
  ) {
    const testDate = new Date(body.date);

    if (isNaN(testDate.getTime())) {
      throw new Error('Invalid ISO date format. Example: 2025-01-01T16:50:00.000Z');
    }

    const result = await this.streakService.bumpStreak(userId, testDate);

    return {
      inputUTC: testDate.toISOString(),
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      lastCompletedAt: result.lastCompletedAt,
    };

  }

  // @Post('test/reset')
  // @ApiOperation({
  //   summary: '[TEST] Reset streak for current user',
  // })
  // // @ApiBody({ schema: { type: 'object', properties: { date: { type: 'string', example: '2025-01-01T16:50:00.000Z' } } } })
  // async testResetStreak(
  //   @CurrentUserId() userId: string,
  // ) {
  //   console.log('==========================');
  //   console.log('RESET DEBUG');
  //   console.log('User:', userId);

  //   const streak = await this.streakService.resetStreak(userId);

  //   console.log('After reset:', {
  //     currentStreak: streak.currentStreak,
  //     longestStreak: streak.longestStreak,
  //     lastCompletedAt: streak.lastCompletedAt,
  //     rewardShownAt: streak.rewardShownAt,
  //   });

  //   console.log('==========================');

  //   return {
  //     message: 'Streak reset successfully',
  //     currentStreak: streak.currentStreak,
  //     longestStreak: streak.longestStreak,
  //     lastCompletedAt: streak.lastCompletedAt,
  //   };
  // }
}