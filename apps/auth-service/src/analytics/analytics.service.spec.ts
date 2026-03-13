import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { LessonProgress } from '../../../../apps/course-service/src/progress/entities/progress.entity';
import { Course } from '../../../../apps/course-service/src/courses/entities/course.entity';
import { UserStreak } from '../../../../apps/course-service/src/streaks/entities/user-streak.entity';
import { WebsocketGateway } from '../gateway/websocket.gateway';
import { UserRole, Status } from '@common/enums';
import type { AuthUser } from '@auth';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let userRepo: jest.Mocked<Repository<User>>;
  let lessonProgressRepo: jest.Mocked<Repository<LessonProgress>>;
  let courseRepo: jest.Mocked<Repository<Course>>;
  let userStreakRepo: jest.Mocked<Repository<UserStreak>>;
  let websocketGateway: jest.Mocked<WebsocketGateway>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    avatar: 'avatar-url',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.STUDENT,
    isVerified: true,
    status: Status.ACTIVE,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    sessions: [],
    authAccounts: [],
    passwordResetTokens: [],
  };

  const mockLessonProgress = {
    lessonProgressId: 'progress-1',
    userId: 'user-1',
    lessonId: 'lesson-1',
    status: 'COMPLETED',
    progressPercent: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    lesson: undefined,
  } as unknown as LessonProgress;

  const mockCourse: Course = {
    course_id: 1,
    course_title: 'Test Course',
    isPublished: true,
    createdAt: new Date(),
  } as Course;

  const mockUserStreak: UserStreak = {
    userStreakId: 1,
    userId: 'user-1',
    currentStreak: 5,
    longestStreak: 10,
    lastCompletedAt: new Date(),
    rewardShownAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const userRepoMock = {
      count: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const lessonProgressRepoMock = {
      createQueryBuilder: jest.fn(),
    };

    const courseRepoMock = {
      count: jest.fn(),
    };

    const userStreakRepoMock = {
      createQueryBuilder: jest.fn(),
    };

    const websocketGatewayMock = {
      getOnlineUserIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(User, 'auth'),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(LessonProgress, 'course'),
          useValue: lessonProgressRepoMock,
        },
        {
          provide: getRepositoryToken(Course, 'course'),
          useValue: courseRepoMock,
        },
        {
          provide: getRepositoryToken(UserStreak, 'course'),
          useValue: userStreakRepoMock,
        },
        {
          provide: WebsocketGateway,
          useValue: websocketGatewayMock,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    userRepo = module.get(getRepositoryToken(User, 'auth')) as jest.Mocked<Repository<User>>;
    lessonProgressRepo = module.get(getRepositoryToken(LessonProgress, 'course')) as jest.Mocked<Repository<LessonProgress>>;
    courseRepo = module.get(getRepositoryToken(Course, 'course')) as jest.Mocked<Repository<Course>>;
    userStreakRepo = module.get(getRepositoryToken(UserStreak, 'course')) as jest.Mocked<Repository<UserStreak>>;
    websocketGateway = module.get(WebsocketGateway) as jest.Mocked<WebsocketGateway>;
  });

  describe('getDashboardAnalytics', () => {
    const mockAuthUser: AuthUser = {
      userId: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.OWNER,
    };

    it('should return full analytics for OWNER role', async () => {
      // Mock user count
      userRepo.count.mockResolvedValue(100);
      userRepo.count.mockResolvedValueOnce(80); // active users

      // Mock course count
      courseRepo.count.mockResolvedValue(12);

      // Mock lesson progress queries (for active learners, daily active, course progress)
      const mockLessonQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '50' }),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      // Mock user streak queries (for ever studied and streaks)
      const mockStreakQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '70' }), // users who ever studied
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      lessonProgressRepo.createQueryBuilder.mockReturnValue(mockLessonQueryBuilder as any);
      userRepo.createQueryBuilder.mockReturnValue(mockLessonQueryBuilder as any);
      userStreakRepo.createQueryBuilder.mockReturnValue(mockStreakQueryBuilder as any);

      const result = await service.getDashboardAnalytics(mockAuthUser);

      expect(result).toHaveProperty('learningOverview');
      expect(result).toHaveProperty('ownerOverview');
      expect(result.learningOverview).toHaveProperty('activeLearners');
      expect(result.learningOverview).toHaveProperty('dailyActiveLearners');
      expect(result.ownerOverview).toHaveProperty('totalUsers');
      expect(result.ownerOverview).toHaveProperty('userActivity');
      expect(result.ownerOverview).toHaveProperty('streaks');
    });

    it('should return only learning overview for ADMIN role', async () => {
      const adminUser: AuthUser = {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '30' }),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      lessonProgressRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getDashboardAnalytics(adminUser);

      expect(result).toHaveProperty('learningOverview');
      expect(result).not.toHaveProperty('ownerOverview');
    });
  });

  describe('getActiveUsersInLast7Days', () => {
    it('should return count of active users in last 7 days', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '45' }),
      };

      lessonProgressRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service['getActiveUsersInLast7Days']();

      expect(result).toBe(45);
      expect(lessonProgressRepo.createQueryBuilder).toHaveBeenCalledWith('lp');
    });
  });

  describe('User Activity Calculation', () => {
    it('should correctly calculate user activity stats using UserStreak', async () => {
      // Mock data
      userRepo.count.mockResolvedValue(100); // total users
      userStreakRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '70' }), // users who ever studied
      } as any);
      
      lessonProgressRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '20' }), // active users in 7 days
      } as any);

      // Mock other required methods
      courseRepo.count.mockResolvedValue(10);
      jest.spyOn(service as any, 'getUsersByTimeRange').mockResolvedValue([]);
      jest.spyOn(service as any, 'getAdminStatusSummary').mockResolvedValue({ total: 5, active: 4, invited: 1 });
      jest.spyOn(service as any, 'getStreaksOverview').mockResolvedValue({ buckets: [] });

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      const result = await service['getOwnerOverview']();

      // Verify calculations
      expect(result.totalUsers).toBe(100);
      expect(result.userActivity.active).toBe(20); // active users
      expect(result.userActivity.inactive).toBe(50); // 70 - 20 = 50 (ever studied but not active)
      
      // Verify log was called with correct stats
      expect(loggerSpy).toHaveBeenCalledWith(
        'User Activity Stats - Total: 100, Ever Studied: 70, Active: 20, Inactive: 50, Never Started: 30'
      );
    });
  });

  describe('getDailyActiveLearnerCount', () => {
    it('should return count of daily active learners', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '10' }),
      };

      lessonProgressRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service['getDailyActiveLearnerCount']();

      expect(result).toBe(10);
    });
  });

  describe('getStreaksOverview', () => {
    it('should return streak buckets', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          bucket1_9: '150',
          bucket10_29: '25',
          bucket30_99: '10',
          bucket100_199: '5',
          bucket200_plus: '2',
        }),
      };

      userStreakRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service['getStreaksOverview']();

      expect(result.buckets).toHaveLength(5);
      expect(result.buckets[0]).toEqual({ label: '1-9 วัน', count: 150 });
      expect(result.buckets[4]).toEqual({ label: '200+ วัน', count: 2 });
    });
  });
});
