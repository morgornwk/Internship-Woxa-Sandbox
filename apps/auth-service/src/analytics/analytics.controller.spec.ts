import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '@common/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@auth';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: jest.Mocked<AnalyticsService>;

  const mockAuthUser: AuthUser = {
    userId: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.OWNER,
  };

  const mockAnalyticsResponse = {
    learningOverview: {
      activeLearners: 50,
      dailyActiveLearners: 10,
      completedCourses: 25,
      inProgressCourses: 30,
    },
    ownerOverview: {
      totalUsers: 100,
      usersByMonth: [
        { month: '2026-01', count: 10 },
        { month: '2026-02', count: 15 },
      ],
      admins: { total: 3, active: 2, invited: 1 },
      totalCourses: 12,
      userActivity: { active: 80, inactive: 20 },
      streaks: {
        buckets: [
          { label: '1 วัน', count: 40 },
          { label: '10 วัน', count: 30 },
        ],
      },
    },
  };

  const mockDashboardUsers = {
    users: [
      {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        avatar: null,
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.STUDENT,
        isVerified: true,
        status: 'online',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
  };

  beforeEach(async () => {
    const analyticsServiceMock = {
      getDashboardAnalytics: jest.fn(),
      getDashboardUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: analyticsServiceMock,
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get(AnalyticsService) as jest.Mocked<AnalyticsService>;
  });

  describe('getDashboardAnalytics', () => {
    it('should return analytics data for authenticated user', async () => {
      service.getDashboardAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getDashboardAnalytics(
        mockAuthUser,
        'last12Months',
      );

      expect(service.getDashboardAnalytics).toHaveBeenCalledWith(
        mockAuthUser,
        'last12Months',
      );
      expect(result).toEqual(mockAnalyticsResponse);
    });

    it('should call service with default timeRange when not provided', async () => {
      service.getDashboardAnalytics.mockResolvedValue(mockAnalyticsResponse);

      await controller.getDashboardAnalytics(mockAuthUser);

      expect(service.getDashboardAnalytics).toHaveBeenCalledWith(
        mockAuthUser,
        undefined,
      );
    });

    it('should return learning overview only for ADMIN role', async () => {
      const adminUser: AuthUser = {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const adminResponse = {
        learningOverview: mockAnalyticsResponse.learningOverview,
      };

      service.getDashboardAnalytics.mockResolvedValue(adminResponse);

      const result = await controller.getDashboardAnalytics(adminUser);

      expect(result).toEqual(adminResponse);
      expect(result).not.toHaveProperty('ownerOverview');
    });

    it('should return full overview for OWNER role', async () => {
      service.getDashboardAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const result = await controller.getDashboardAnalytics(mockAuthUser);

      expect(result).toHaveProperty('learningOverview');
      expect(result).toHaveProperty('ownerOverview');
    });
  });

  describe('Guards', () => {
    it('should have JwtAuthGuard and RolesGuard decorators', () => {
      // Test that the controller has the appropriate decorators
      const guards = Reflect.getMetadata('__guards__', AnalyticsController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });
  });

  it('should allow ADMIN to access analytics endpoint', async () => {
    const adminUser: AuthUser = {
      userId: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    const adminResponse = {
      learningOverview: mockAnalyticsResponse.learningOverview,
    };

    service.getDashboardAnalytics.mockResolvedValue(adminResponse);

    const result = await controller.getDashboardAnalytics(adminUser);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('learningOverview');
    expect(result).not.toHaveProperty('ownerOverview');
  });
});
