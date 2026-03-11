import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@auth';
import { UserRole } from '@common/enums';
import type { AuthUser } from '@auth';

import { AnalyticsService } from './analytics.service';
import { AdminDashboardAnalyticsDto} from './dto/admin-dashboard-analytics.dto';

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
    summary: 'ดึงข้อมูล Analytics ของ Admin Dashboard (read-only)',
    description:
      "ส่งคืนข้อมูลรวมการใช้งานแพลตฟอร์มและผลลัพธ์การเรียนรู้สำหรับ Admin Dashboard. " +
      "การตอบกลับแบ่งตามสิทธิ์: ADMIN จะได้เฉพาะ learningOverview; OWNER จะได้ทั้ง learningOverview และ ownerOverview.\n\n" +
      "ตัวเลือก timeRange:\n" +
      "- last12Months: ข้อมูล 12 เดือนล่าสุด (default)\n" +
      "- yearYYYY: ข้อมูลเฉพาะปีที่ระบุ (เช่น year2026)\n" +
      "- allTime: ข้อมูลทั้งหมดตั้งแต่เริ่มระบบ\n\n" +
      "ตัวอย่าง ADMIN:\n" +
      "{\n" +
      "  \"learningOverview\": {\n" +
      "    \"activeLearners\": 12,\n" +
      "    \"dailyActiveLearners\": 5,\n" +
      "    \"completedCourses\": 3,\n" +
      "    \"inProgressCourses\": 24\n" +
      "  }\n" +
      "}\n\n" +
      "ตัวอย่าง OWNER:\n" +
      "{\n" +
      "  \"learningOverview\": {\n" +
      "    \"activeLearners\": 12,\n" +
      "    \"dailyActiveLearners\": 5,\n" +
      "    \"completedCourses\": 3,\n" +
      "    \"inProgressCourses\": 24\n" +
      "  },\n" +
      "  \"ownerOverview\": {\n" +
      "    \"totalUsers\": 120,\n" +
      "    \"usersByMonth\": [\n" +
      "      { \"month\": \"2026-01\", \"count\": 10 },\n" +
      "      { \"month\": \"2026-02\", \"count\": 15 },\n" +
      "      { \"month\": \"2026-03\", \"count\": 8 },\n" +
      "      { \"month\": \"2026-04\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-05\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-06\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-07\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-08\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-09\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-10\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-11\", \"count\": 0 },\n" +
      "      { \"month\": \"2026-12\", \"count\": 0 }\n" +
      "    ],\n" +
      "    \"admins\": { \"total\": 3, \"active\": 2, \"invited\": 1 },\n" +
      "    \"totalCourses\": 12,\n" +
      "    \"userActivity\": { \"active\": 800, \"inactive\": 200 },\n" +
      "    \"streaks\": {\n" +
      "      \"buckets\": [\n" +
      "        { \"label\": \"1 วัน\", \"count\": 420 },\n" +
      "        { \"label\": \"10 วัน\", \"count\": 300 },\n" +
      "        { \"label\": \"30 วัน\", \"count\": 160 },\n" +
      "        { \"label\": \"100 วัน\", \"count\": 80 },\n" +
      "        { \"label\": \"300 วัน\", \"count\": 40 }\n" +
      "      ]\n" +
      "    }\n" +
      "  }\n" +
      "}",
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'ช่วงเวลาสำหรับข้อมูลผู้ใช้รายเดือน (default: last12Months)',
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
    // ส่งข้อมูล user และ timeRange ให้ Service ประมวลผลต่อ
    return this.analyticsService.getDashboardAnalytics(user, timeRange);
  }
}
