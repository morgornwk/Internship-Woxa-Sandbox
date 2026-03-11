import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';
import type { AuthUser } from '@auth';

import { AnalyticsService } from './analytics.service';
import { AdminDashboardAnalyticsDto } from './dto/admin-dashboard-analytics.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth('access-token')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('analytics')
  @ApiOperation({
    summary: 'ดึงข้อมูล Analytics ของ Admin Dashboard',
    description: 'สำหรับ ADMIN จะได้ข้อมูลภาพรวมการเรียนรู้ของผู้ใช้ ส่วน OWNER จะได้ข้อมูลภาพรวมทั้งหมด รวมถึงข้อมูลผู้ใช้และการใช้งาน',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'ช่วงเวลาสำหรับข้อมูลผู้ใช้รายเดือน',
    example: 'last12Months',
    enum: ['last12Months', 'year2026', 'year2025', 'allTime'],
  })
  @ApiResponse({
    status: 200,
    type: AdminDashboardAnalyticsDto,
    description: 'Successful analytics response (shape depends on role).',
    content: {
      'application/json': {
        examples: {
          admin: {
            summary: 'ADMIN (learning overview only)',
            value: {
              learningOverview: {
                activeLearners: 10,
                dailyActiveLearners: 4,
                completedCourses: 2,
                inProgressCourses: 5,
              },
            },
          },
          owner: {
            summary: 'OWNER (full overview)',
            value: {
              learningOverview: {
                activeLearners: 12,
                dailyActiveLearners: 5,
                completedCourses: 3,
                inProgressCourses: 24,
              },
              ownerOverview: {
                totalUsers: 120,
                usersByMonth: [
                  { month: '2026-01', count: 10 },
                  { month: '2026-02', count: 15 },
                  { month: '2026-03', count: 8 },
                  { month: '2026-04', count: 0 },
                  { month: '2026-05', count: 0 },
                  { month: '2026-06', count: 0 },
                  { month: '2026-07', count: 0 },
                  { month: '2026-08', count: 0 },
                  { month: '2026-09', count: 0 },
                  { month: '2026-10', count: 0 },
                  { month: '2026-11', count: 0 },
                  { month: '2026-12', count: 0 },
                ],
                admins: {
                  total: 3,
                  active: 2,
                  invited: 1,
                },
                totalCourses: 12,
                userActivity: {
                  active: 800,
                  inactive: 200,
                },
                streaks: {
                  buckets: [
                    { label: '1 วัน', count: 420 },
                    { label: '10 วัน', count: 300 },
                    { label: '30 วัน', count: 160 },
                    { label: '100 วัน', count: 80 },
                    { label: '300 วัน', count: 40 },
                  ],
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getDashboardAnalytics(@CurrentUser() user: AuthUser, @Query('timeRange') timeRange?: string): Promise<AdminDashboardAnalyticsDto> {
    return this.analyticsService.getDashboardAnalytics(user, timeRange);
  }
}
