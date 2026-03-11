import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO สำหรับข้อมูลผู้ใช้ในรายเดือน (สำหรับกราฟ usersByMonth ใน OwnerOverview)
export class UsersByMonthPointDto {
  @ApiProperty({ example: '2026-01', description: 'Year-month label (YYYY-MM)' })
  month: string;

  @ApiProperty({ example: 120, description: 'Number of registered users created in that month' })
  count: number;
}

// DTO สำหรับข้อมูลผู้ใช้ในรายเดือน (สำหรับ endpoint /analytics/users)
export class LearningOverviewDto {
  @ApiProperty({ description: 'Active learners (unique users who have started learning and are not only in LOCKED state)' })
  activeLearners: number;

  @ApiProperty({ description: 'Daily attendance count (distinct users with progress today)' })
  dailyActiveLearners: number;

  @ApiProperty({ description: 'Number of user-course pairs where all lessons in the course are completed/skipped' })
  completedCourses: number;

  @ApiProperty({ description: 'Number of user-course pairs where the course has been started but not fully completed' })
  inProgressCourses: number;
}

// DTO สำหรับสรุปสถานะของ admin accounts (สำหรับ OWNER)
export class AdminStatusSummaryDto {
  @ApiProperty({ description: 'Total number of admin accounts (role = ADMIN only)' })
  total: number;

  @ApiProperty({ description: "Number of admin accounts with status 'active'" })
  active: number;

  @ApiProperty({ description: "Number of admin accounts with status 'invited'" })
  invited: number;
}

// DTO สำหรับสรุป Active vs Inactive users (สำหรับ OWNER)
export class UserActivitySummaryDto {
  @ApiProperty({ description: 'Active users within the recent activity window' })
  active: number;

  @ApiProperty({ description: 'Inactive users within the recent activity window' })
  inactive: number;
}

// DTO สำหรับแต่ละ bucket ของ Streaks (สำหรับ OWNER)
export class StreakBucketDto {
  @ApiProperty({ description: 'Bucket label' })
  label: string;

  @ApiProperty({ description: 'User count in this bucket' })
  count: number;
}

export class StreaksOverviewDto {
  @ApiProperty({ type: () => [StreakBucketDto] })
  buckets: StreakBucketDto[];
}


// DTO สำหรับข้อมูล Owner-only analytics (visible เฉพาะ OWNER)
export class OwnerOverviewDto {
  @ApiProperty({ description: 'Total user accounts in the system (all roles)' })
  totalUsers: number;

  @ApiProperty({
    type: () => [UsersByMonthPointDto],
    description: 'Monthly registered users for the requested timeRange. Always returns complete data (missing months have count=0).',
  })
  usersByMonth: UsersByMonthPointDto[];

  @ApiProperty({ type: () => AdminStatusSummaryDto, description: 'Admin accounts summary (ADMIN + OWNER)' })
  admins: AdminStatusSummaryDto;

  @ApiProperty({ description: 'Total courses count' })
  totalCourses: number;

  @ApiProperty({ type: () => UserActivitySummaryDto, description: 'Active vs inactive users summary' })
  userActivity: UserActivitySummaryDto;

  @ApiProperty({ type: () => StreaksOverviewDto, description: 'Streak distribution summary' })
  streaks: StreaksOverviewDto;
}

// DTO หลักสำหรับ Admin Dashboard Analytics Endpoint
export class AdminDashboardAnalyticsDto {
  @ApiProperty({ type: () => LearningOverviewDto, description: 'Learning analytics visible to ADMIN and OWNER' })
  learningOverview: LearningOverviewDto;

  @ApiPropertyOptional({ type: () => OwnerOverviewDto, description: 'Owner-only analytics (visible only to OWNER)' })
  ownerOverview?: OwnerOverviewDto;

  @ApiProperty({
    example: {
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
  })
  static example: AdminDashboardAnalyticsDto;
}
