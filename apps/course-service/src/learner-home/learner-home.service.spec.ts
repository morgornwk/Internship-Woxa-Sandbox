import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { LearnerHomeService } from './learner-home.service';
import { StreakService } from '../streaks/streak.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LessonProgress } from '../progress/entities/progress.entity';
import { UserXp } from '../quizs/entities/user-xp.entity';
import { Course } from '../courses/entities/course.entity';

describe('LearnerHomeService', () => {
  let service: LearnerHomeService;
  let httpService: any;
  let configService: any;

  type StreakServiceMock = {
    getStreak: jest.Mock;
  };

  type NotificationsServiceMock = {
    getUnreadCount: jest.Mock;
  };

  type LessonProgressRepoMock = {
    createQueryBuilder: jest.Mock;
  };

  type UserXpRepoMock = {
    createQueryBuilder: jest.Mock;
  };

  type CourseRepoMock = {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
  };

  let streakService: StreakServiceMock;
  let notificationsService: NotificationsServiceMock;
  let lessonProgressRepo: LessonProgressRepoMock;
  let userXpRepo: UserXpRepoMock;
  let courseRepo: CourseRepoMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearnerHomeService,
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              get: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://auth/api'),
          },
        },
        {
          provide: StreakService,
          useValue: {
            getStreak: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            getUnreadCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LessonProgress),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserXp),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(LearnerHomeService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    streakService = module.get(StreakService);
    notificationsService = module.get(NotificationsService);
    lessonProgressRepo = module.get(getRepositoryToken(LessonProgress));
    userXpRepo = module.get(getRepositoryToken(UserXp));
    courseRepo = module.get(getRepositoryToken(Course));

    jest.clearAllMocks();
  });

  it('throws UnauthorizedException when userId missing', async () => {
    await expect(service.getHome('', 'Bearer x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns aggregated home data and skips profile when internalCall=true', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 5 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(2);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '123' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          status: 'IN_PROGRESS',
          progressPercent: 40,
          lesson: {
            chapter: {
              chapter_title: 'Ch1',
              level: {
                level_title: 'L1',
                course: {
                  course_id: 10,
                  course_title: 'C1',
                },
              },
            },
          },
        },
      ]),
    };

    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 101,
          status: 'COMPLETED',
          lesson: {
            chapter: {
              level: {
                course: { course_id: 10, course_title: 'C1' },
              },
            },
          },
        },
        {
          lessonId: 102,
          status: 'IN_PROGRESS',
          progressPercent: 40,
          lesson: {
            chapter: {
              level: {
                course: { course_id: 10, course_title: 'C1' },
              },
            },
          },
        },
      ]),
    };

    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    const courseStructureQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          course_id: 10,
          course_title: 'C1',
          course_levels: [
            {
              level_chapters: [
                {
                  isPublished: true,
                  lessons: [
                    { lesson_id: 101, isPublished: true },
                    { lesson_id: 102, isPublished: true },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    };
    (courseRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(courseStructureQb)
      .mockReturnValueOnce(courseStructureQb);

    courseRepo.find!.mockResolvedValue([
      { course_id: 1, course_title: 'R1', course_imageUrl: null } as any,
      { course_id: 2, course_title: 'R2', course_imageUrl: 'img2' } as any,
    ]);

    const res = await service.getHome('u1', 'Bearer x', 'true');

    expect(res.header.userId).toBe('u1');
    expect(res.header.avatarUrl).toBeNull();
    expect(res.header.xp).toBe(123);
    expect(res.header.streakDays).toBe(5);

    expect(res.continueLearning?.course_id).toBe(10);
    expect(res.continueLearning?.progressPercent).toBe(0);
    expect(res.myCourses).toEqual([{ course_id: 10, title: 'C1', progressPercent: 50 }]);
    expect(res.notifications.unreadCount).toBe(2);
    expect(res.recommendations.courses).toHaveLength(2);
    expect(courseRepo.find).toHaveBeenCalledWith({
      where: { isPublished: true },
      order: { updatedAt: 'DESC' },
      take: 3,
    });

    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
  });

  it('fetches profile when authorization provided and not internalCall', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 1 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    (courseRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    courseRepo.find!.mockResolvedValue([]);

    httpService.axiosRef.get.mockResolvedValue({ data: { avatarUrl: 'ava' } });

    const res = await service.getHome('u1', 'Bearer x');

    expect(configService.get).toHaveBeenCalled();
    expect(httpService.axiosRef.get).toHaveBeenCalledWith('http://auth/api/users/profile', {
      headers: { Authorization: 'Bearer x', 'X-Internal-Call': 'true' },
    });
    expect(res.header.avatarUrl).toBe('ava');
    expect(courseRepo.find).toHaveBeenCalledWith({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
      take: 3,
    });
  });

  it('returns latest created courses for new users', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 0 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    (courseRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    courseRepo.find!.mockResolvedValue([
      { course_id: 99, course_title: 'Newest', course_imageUrl: null } as any,
    ]);

    const res = await service.getHome('u2', 'Bearer x', 'true');

    expect(courseRepo.find).toHaveBeenCalledWith({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
      take: 3,
    });
    expect(res.recommendations.courses).toEqual([
      {
        course_id: 99,
        course_title: 'Newest',
        reason: 'คอร์สใหม่ล่าสุด',
        course_imageUrl: null,
        level_name: 'ระดับพื้นฐาน',
        course_totalChapter: 6,
      },
    ]);
  });

  it('ignores view-only progress records with zero percent on learner home', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 0 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          status: 'IN_PROGRESS',
          progressPercent: 0,
          lesson: {
            chapter: {
              chapter_title: 'Preview Chapter',
              level: {
                level_title: 'L1',
                course: { course_id: 22, course_title: 'Preview Course' },
              },
            },
          },
        },
      ]),
    };
    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          status: 'IN_PROGRESS',
          progressPercent: 0,
          lesson: {
            chapter: {
              level: {
                course: { course_id: 22, course_title: 'Preview Course' },
              },
            },
          },
        },
      ]),
    };
    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    (courseRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    courseRepo.find!.mockResolvedValue([]);

    const res = await service.getHome('u3', 'Bearer x', 'true');

    expect(res.continueLearning).toBeNull();
    expect(res.myCourses).toEqual([]);
    expect(courseRepo.find).toHaveBeenCalledWith({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
      take: 3,
    });
  });

  it('falls back to defaults when subcalls throw', async () => {
    (streakService.getStreak as jest.Mock).mockRejectedValue(new Error('boom'));
    (notificationsService.getUnreadCount as jest.Mock).mockRejectedValue(new Error('boom'));

    userXpRepo.createQueryBuilder!.mockImplementation(() => {
      throw new Error('boom');
    });

    (lessonProgressRepo.createQueryBuilder as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    (courseRepo.createQueryBuilder as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    courseRepo.find!.mockRejectedValue(new Error('boom'));

    const res = await service.getHome('u1', 'Bearer x', 'true');

    expect(res.header.streakDays).toBe(0);
    expect(res.header.xp).toBe(0);
    expect(res.continueLearning).toBeNull();
    expect(res.myCourses).toEqual([]);
    expect(res.notifications.unreadCount).toBe(0);
    expect(res.recommendations.courses).toEqual([]);
  });

  it('excludes draft chapters and lessons from progress calculations', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 0 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    // Mock progress data: includes both published and draft lessons
    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 101, // Published lesson
          status: 'COMPLETED',
          lesson: {
            lesson_id: 101,
            isPublished: true,
            chapter: {
              chapter_id: 1,
              isPublished: true,
              chapter_title: 'Published Chapter',
              level: {
                level_title: 'L1',
                course: { 
                  course_id: 10, 
                  course_title: 'Course with Draft Content' 
                },
              },
            },
          },
        },
        {
          lessonId: 102, // Draft lesson (should not count)
          status: 'COMPLETED',
          lesson: {
            lesson_id: 102,
            isPublished: false,
            chapter: {
              chapter_id: 1,
              isPublished: true,
              chapter_title: 'Published Chapter',
              level: {
                level_title: 'L1',
                course: { 
                  course_id: 10, 
                  course_title: 'Course with Draft Content' 
                },
              },
            },
          },
        },
      ]),
    };

    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 101, // Published lesson
          status: 'COMPLETED',
          lesson: {
            lesson_id: 101,
            isPublished: true,
            chapter: {
              chapter_id: 1,
              isPublished: true,
              level: {
                course: { course_id: 10, course_title: 'Course with Draft Content' },
              },
            },
          },
        },
        {
          lessonId: 102, // Draft lesson (should not count)
          status: 'COMPLETED',
          lesson: {
            lesson_id: 102,
            isPublished: false,
            chapter: {
              chapter_id: 1,
              isPublished: true,
              level: {
                course: { course_id: 10, course_title: 'Course with Draft Content' },
              },
            },
          },
        },
        {
          lessonId: 103, // Draft chapter (should not count)
          status: 'COMPLETED',
          lesson: {
            lesson_id: 103,
            isPublished: true,
            chapter: {
              chapter_id: 2,
              isPublished: false, // Draft chapter
              chapter_title: 'Draft Chapter',
              level: {
                course: { course_id: 10, course_title: 'Course with Draft Content' },
              },
            },
          },
        },
      ]),
    };

    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    // Mock course structure with mixed published/draft content
    const courseStructureQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          course_id: 10,
          course_title: 'Course with Draft Content',
          course_levels: [
            {
              level_chapters: [
                {
                  isPublished: true, // Published chapter
                  lessons: [
                    { lesson_id: 101, isPublished: true },  // Published lesson
                    { lesson_id: 102, isPublished: false }, // Draft lesson
                  ],
                },
                {
                  isPublished: false, // Draft chapter (should be filtered out by query)
                  lessons: [
                    { lesson_id: 103, isPublished: true },  // Lesson in draft chapter
                  ],
                },
              ],
            },
          ],
        },
      ]),
    };
    (courseRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(courseStructureQb)
      .mockReturnValueOnce(courseStructureQb);

    courseRepo.find!.mockResolvedValue([]);

    const res = await service.getHome('u1', 'Bearer x', 'true');

    // Verify that only published content is counted
    expect(res.continueLearning?.course_id).toBe(10);
    expect(res.continueLearning?.progressPercent).toBe(100); // Chapter 100% (1/1 published lesson completed)
    
    // Only published lessons should count: 1 completed out of 1 published lesson = 100%
    expect(res.myCourses).toEqual([{ 
      course_id: 10, 
      title: 'Course with Draft Content', 
      progressPercent: 100 // Only published lessons counted
    }]);

    // Verify that the query filters were applied correctly
    expect(courseRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('handles course with only draft content gracefully', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 0 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    // Mock progress data for draft content only
    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 201,
          status: 'COMPLETED',
          lesson: {
            lesson_id: 201,
            isPublished: true,
            chapter: {
              chapter_id: 3,
              isPublished: false, // Draft chapter
              chapter_title: 'Draft Chapter Only',
              level: {
                level_title: 'L1',
                course: { 
                  course_id: 20, 
                  course_title: 'All Draft Course' 
                },
              },
            },
          },
        },
      ]),
    };

    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 201,
          status: 'COMPLETED',
          lesson: {
            lesson_id: 201,
            isPublished: true,
            chapter: {
              chapter_id: 3,
              isPublished: false, // Draft chapter
              level: {
                course: { course_id: 20, course_title: 'All Draft Course' },
              },
            },
          },
        },
      ]),
    };

    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    // Mock course structure with only draft content
    const courseStructureQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          course_id: 20,
          course_title: 'All Draft Course',
          course_levels: [
            {
              level_chapters: [
                {
                  isPublished: false, // Only draft chapters
                  lessons: [
                    { lesson_id: 201, isPublished: true },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    };
    (courseRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(courseStructureQb)
      .mockReturnValueOnce(courseStructureQb);

    courseRepo.find!.mockResolvedValue([]);

    const res = await service.getHome('u1', 'Bearer x', 'true');

    // Should handle gracefully - no published content to count
    expect(res.continueLearning?.course_id).toBe(20);
    expect(res.continueLearning?.progressPercent).toBe(0);
    expect(res.myCourses).toEqual([]); // No published content = no courses shown
  });

  it('calculates correct progress when course has mixed published/draft chapters', async () => {
    (streakService.getStreak as jest.Mock).mockResolvedValue({ streak: { currentStreak: 0 } });
    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue(0);

    const userXpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    userXpRepo.createQueryBuilder!.mockReturnValue(userXpQb);

    // Mock progress where user completed lessons in both published and draft chapters
    const continueLearningQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 301,
          status: 'COMPLETED',
          lesson: {
            lesson_id: 301,
            isPublished: true,
            chapter: {
              chapter_id: 4,
              isPublished: true,
              chapter_title: 'Published Chapter 1',
              level: {
                level_title: 'L1',
                course: { 
                  course_id: 30, 
                  course_title: 'Mixed Content Course' 
                },
              },
            },
          },
        },
      ]),
    };

    const myCoursesQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          lessonId: 301, // Published chapter, published lesson
          status: 'COMPLETED',
          lesson: {
            lesson_id: 301,
            isPublished: true,
            chapter: {
              chapter_id: 4,
              isPublished: true,
              level: {
                course: { course_id: 30, course_title: 'Mixed Content Course' },
              },
            },
          },
        },
        {
          lessonId: 302, // Published chapter, draft lesson
          status: 'COMPLETED',
          lesson: {
            lesson_id: 302,
            isPublished: false,
            chapter: {
              chapter_id: 4,
              isPublished: true,
              level: {
                course: { course_id: 30, course_title: 'Mixed Content Course' },
              },
            },
          },
        },
        {
          lessonId: 303, // Draft chapter, published lesson
          status: 'COMPLETED',
          lesson: {
            lesson_id: 303,
            isPublished: true,
            chapter: {
              chapter_id: 5,
              isPublished: false,
              level: {
                course: { course_id: 30, course_title: 'Mixed Content Course' },
              },
            },
          },
        },
      ]),
    };

    (lessonProgressRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(continueLearningQb)
      .mockReturnValueOnce(myCoursesQb);

    // Mock course structure: 2 published chapters, 1 draft chapter
    const courseStructureQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          course_id: 30,
          course_title: 'Mixed Content Course',
          course_levels: [
            {
              level_chapters: [
                {
                  isPublished: true,
                  lessons: [
                    { lesson_id: 301, isPublished: true },  // Count: completed
                    { lesson_id: 302, isPublished: false }, // Count: excluded (draft)
                    { lesson_id: 304, isPublished: true },  // Count: not completed
                  ],
                },
                {
                  isPublished: true,
                  lessons: [
                    { lesson_id: 305, isPublished: true },  // Count: not completed
                  ],
                },
                {
                  isPublished: false, // Excluded by query filter
                  lessons: [
                    { lesson_id: 303, isPublished: true },  // Would be in draft chapter
                  ],
                },
              ],
            },
          ],
        },
      ]),
    };
    (courseRepo.createQueryBuilder as jest.Mock)
      .mockReturnValueOnce(courseStructureQb)
      .mockReturnValueOnce(courseStructureQb);

    courseRepo.find!.mockResolvedValue([]);

    const res = await service.getHome('u1', 'Bearer x', 'true');

    // Only published content should be counted:
    // Published lessons: 301, 304, 305 = 3 total
    // Completed published lessons: 301 = 1 completed
    // Progress = 1/3 * 100 = 33%
    expect(res.continueLearning?.course_id).toBe(30);
    expect(res.continueLearning?.progressPercent).toBe(33); // Chapter 100% (1/1 published lesson completed in current chapter)
    expect(res.myCourses).toEqual([{ 
      course_id: 30, 
      title: 'Mixed Content Course', 
      progressPercent: 33 // Only published lessons counted
    }]);
  });
});
