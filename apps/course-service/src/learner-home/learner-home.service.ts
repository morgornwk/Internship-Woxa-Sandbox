import { Injectable, Optional, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { StreakService } from '../streaks/streak.service';
import { NotificationsService } from '../notifications/notifications.service';

import { LessonProgress } from '../progress/entities/progress.entity';
import { UserXp } from '../quizs/entities/user-xp.entity';
import { Course } from '../courses/entities/course.entity';
import { RedisCacheService } from '../cache/redis-cache.service';

import { LearnerHomeResponseDto } from './dto/learner-home-response.dto';

// ประกาศ interface สำหรับข้อมูลโปรไฟล์ผู้ใช้ที่ดึงมาจาก Auth Service (ถ้าต้องการใช้ข้อมูลอื่นๆ นอกจาก avatarUrl ให้เพิ่มฟิลด์ในนี้ได้เลย)
interface UserProfile {
  avatarUrl: string | null;
}

@Injectable()
export class LearnerHomeService {
  private readonly logger = new Logger(LearnerHomeService.name);
  private static readonly HOME_TTL_SECONDS = 120;
  private static readonly RECOMMENDATIONS_TTL_SECONDS = 300;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly streakService: StreakService,
    private readonly notificationsService: NotificationsService,

    @InjectRepository(LessonProgress)
    private readonly lessonProgressRepository: Repository<LessonProgress>,

    @InjectRepository(UserXp)
    private readonly userXpRepository: Repository<UserXp>,

    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,

    @Optional()
    private readonly redisCacheService?: RedisCacheService,
  ) {}

  async getHome(
    userId: string,
    authorization?: string,
    internalCall?: string,
  ): Promise<LearnerHomeResponseDto> {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const shouldSkipProfile = internalCall === 'true';
    const cacheKey = `learner-home:user:${userId}:profile:${shouldSkipProfile ? 'off' : 'on'}`;

    return (
      this.redisCacheService?.wrap(
        cacheKey,
        LearnerHomeService.HOME_TTL_SECONDS,
        async () =>
          this.buildHomeResponse(userId, authorization, shouldSkipProfile),
      ) ?? this.buildHomeResponse(userId, authorization, shouldSkipProfile)
    );
  }

  // ดึง profile ผ่าน Auth Service แบบ internal call (ส่ง X-Internal-Call header กัน loop)
  private async getUserProfileFromAuth(
    authorization?: string,
  ): Promise<UserProfile | null> {
    if (!authorization) return null;

    try {
      const authBaseUrl = this.configService.get<string>(
        'AUTH_BASE_URL',
        'http://localhost:3001/api',
      );

      const response = await this.httpService.axiosRef.get(
        `${authBaseUrl}/users/profile`,
        {
          headers: {
            Authorization: authorization,
            'X-Internal-Call': 'true', // ส่ง header เพื่อบอกว่าเป็น internal call
          },
        },
      );

      return { avatarUrl: response.data?.avatarUrl ?? null };
    } catch {
      return null;
    }
  }

  // ดึงข้อมูล streak ปัจจุบันของผู้ใช้จาก StreakService
  private async getStreak(userId: string) {
    const { streak } = await this.streakService.getStreak(userId);
    return streak;
  }

  // ดึงข้อมูล total XP ของผู้ใช้จากฐานข้อมูล UserXp โดยรวมค่า xpEarned ทั้งหมดที่ผู้ใช้ได้รับมาแล้ว
  private async getTotalXp(userId: string) {
    const result = await this.userXpRepository
      .createQueryBuilder('ux')
      .select('COALESCE(SUM(ux.xpEarned), 0)', 'total')
      .where('ux.userId = :userId', { userId })
      .getRawOne<{ total: string }>();

    const totalXp = Number(result?.total ?? 0);

    return totalXp;
  }

  // ดึงข้อมูลบทเรียนล่าสุดที่ผู้ใช้กำลังเรียนอยู่ (ยังไม่จบ) เพื่อแสดงในส่วน Continue Learning ของหน้าแรก โดยเรียงลำดับจากบทเรียนที่มีการอัปเดตล่าสุด
  private async getContinueLearning(userId: string) {
    const progressList = await this.lessonProgressRepository
      .createQueryBuilder('lp')
      .leftJoinAndSelect('lp.lesson', 'lesson')
      .leftJoinAndSelect('lesson.chapter', 'chapter')
      .leftJoinAndSelect('chapter.level', 'level')
      .leftJoinAndSelect('level.course', 'course')
      .where('lp.userId = :userId', { userId })
      .orderBy('lp.lastViewedAt', 'DESC')
      .getMany();

    const latest = progressList.find((progress) =>
      this.hasStartedLearning(progress),
    );

    // ถ้าไม่มีบทเรียนที่กำลังเรียนอยู่เลย หรือข้อมูลไม่ครบถ้วน ให้คืนค่า null เพื่อให้ frontend แสดงผลแบบไม่มีบทเรียนที่กำลังเรียนอยู่
    if (!latest?.lesson?.chapter?.level?.course) return null;

    // ดึงข้อมูลที่จำเป็นจาก entity ที่เชื่อมโยงกันมาแสดงในส่วน Continue Learning โดยมี fallback ค่าเริ่มต้นสำหรับข้อมูลที่อาจจะไม่มี
    const lesson = latest.lesson;
    const chapter = lesson.chapter;
    const level = chapter.level;
    const course = level.course;

    // คำนวณ progress ของ chapter ปัจจุบัน
    const chapterProgress = await this.getChapterProgress(
      chapter.chapter_id,
      progressList,
    );

    // ถ้า chapter ยังไม่ 100% ให้ progressPercent = 0
    // ถ้า chapter 100% แล้ว ให้คำนวณจากทั้งคอร์ส
    let progressPercent = 0;
    if (chapterProgress >= 100) {
      const courseProgressMap = await this.getCourseProgressMap(
        [latest],
        progressList,
      );
      progressPercent =
        courseProgressMap.get(course.course_id)?.progressPercent ?? 0;
    }

    return {
      course_id: course.course_id,
      course_title: course.course_title,
      chapter_title: chapter.chapter_title,
      level_name: level.level_title,
      progressPercent,
    };
  }

  // ดึงข้อมูลคอร์สที่ผู้ใช้กำลังเรียนอยู่ทั้งหมดพร้อมกับความคืบหน้าของแต่ละคอร์ส โดยเรียงลำดับจากคอร์สที่มีการอัปเดตล่าสุด
  private async getMyCourses(userId: string) {
    // ดึงข้อมูล progress ทั้งหมดของ user
    const progressList = await this.lessonProgressRepository
      .createQueryBuilder('lp')
      .leftJoinAndSelect('lp.lesson', 'lesson')
      .leftJoinAndSelect('lesson.chapter', 'chapter')
      .leftJoinAndSelect('chapter.level', 'level')
      .leftJoinAndSelect('level.course', 'course')
      .where('lp.userId = :userId', { userId })
      .getMany();

    const startedProgressList = progressList.filter((progress) =>
      this.hasStartedLearning(progress),
    );

    // ถ้าไม่มีบทเรียนที่กำลังเรียนอยู่เลย หรือข้อมูลไม่ครบถ้วน ให้คืนค่าเป็น array ว่างเพื่อให้ frontend แสดงผลแบบไม่มีคอร์สที่กำลังเรียนอยู่
    if (!startedProgressList.length) return [];

    const courseProgressMap = await this.getCourseProgressMap(
      startedProgressList,
      progressList,
    );

    return Array.from(courseProgressMap.entries()).map(([courseId, data]) => ({
      course_id: courseId,
      title: data.title,
      progressPercent: data.progressPercent,
    }));
  }

  private async getCourseProgressMap(
    relevantProgressList: LessonProgress[],
    progressSourceList: LessonProgress[],
  ) {
    const courseIds = [
      ...new Set(
        relevantProgressList
          .map((progress) => progress.lesson?.chapter?.level?.course?.course_id)
          .filter(
            (courseId): courseId is number => typeof courseId === 'number',
          ),
      ),
    ];

    if (!courseIds.length)
      return new Map<number, { title: string; progressPercent: number }>();

    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.course_levels', 'level')
      // A) กรองตั้งแต่ query: ใช้เฉพาะ chapter/lesson ที่เผยแพร่แล้วในการคำนวณเปอร์เซ็นต์
      .leftJoinAndSelect(
        'level.level_chapters',
        'chapter',
        'chapter.isPublished = :chapterPublished',
        { chapterPublished: true },
      )
      .leftJoinAndSelect(
        'chapter.lessons',
        'lesson',
        'lesson.isPublished = :lessonPublished',
        { lessonPublished: true },
      )
      .where('course.course_id IN (:...courseIds)', { courseIds })
      .getMany();

    const progressMap = new Map<string, LessonProgress>();
    progressSourceList.forEach((progress) => {
      if (progress.lessonId) {
        progressMap.set(progress.lessonId.toString(), progress);
      }
    });

    const courseProgressMap = new Map<
      number,
      { title: string; progressPercent: number }
    >();

    for (const course of courses) {
      let totalLessons = 0;
      let completedLessons = 0;

      for (const level of course.course_levels || []) {
        for (const chapter of level.level_chapters || []) {
          // B) safe guard เผื่ออนาคต query ถูกแก้ไขแล้วดึง draft กลับมาโดยไม่ตั้งใจ
          if (!chapter.isPublished) continue;

          for (const lesson of chapter.lessons || []) {
            if (!lesson.isPublished) continue;

            totalLessons++;

            const progress = progressMap.get(lesson.lesson_id.toString());
            if (
              progress &&
              (progress.status === 'COMPLETED' || progress.status === 'SKIPPED')
            ) {
              completedLessons++;
            }
          }
        }
      }

      if (totalLessons > 0) {
        courseProgressMap.set(course.course_id, {
          title: course.course_title,
          progressPercent: Math.round((completedLessons / totalLessons) * 100),
        });
      }
    }

    return courseProgressMap;
  }

  private async getChapterProgress(
    chapterId: number,
    progressList: LessonProgress[],
  ) {
    // หา progress records ทั้งหมดใน chapter นี้
    const chapterProgressRecords = progressList.filter(
      (progress) => progress.lesson?.chapter?.chapter_id === chapterId,
    );

    if (!chapterProgressRecords.length) return 0;

    // นับ completed/skipped lessons ใน chapter
    const completedLessons = chapterProgressRecords.filter(
      (progress) =>
        progress.status === 'COMPLETED' || progress.status === 'SKIPPED',
    ).length;

    // คำนวณ percent ของ chapter
    return Math.round((completedLessons / chapterProgressRecords.length) * 100);
  }

  private hasStartedLearning(progress: LessonProgress) {
    return (
      Number(progress.progressPercent ?? 0) > 0 ||
      progress.status === 'COMPLETED' ||
      progress.status === 'SKIPPED'
    );
  }

  // ดึงข้อมูล Notifications-Service เพื่อแสดงในส่วนการแจ้งเตือนของหน้าแรก
  private async getNotifications(userId: string) {
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount };
  }

  // ดึงข้อมูล Course Recommendations เพื่อแสดงในส่วนแนะนำคอร์สของหน้าแรก
  private async getRecommendations(isNewUser = false) {
    const cacheKey = `learner-home:recommendations:${isNewUser ? 'new' : 'active'}`;

    return (
      this.redisCacheService?.wrap(
        cacheKey,
        LearnerHomeService.RECOMMENDATIONS_TTL_SECONDS,
        async () => this.getRecommendationsWithoutCache(isNewUser),
      ) ?? this.getRecommendationsWithoutCache(isNewUser)
    );
  }

  private async buildHomeResponse(
    userId: string,
    authorization: string | undefined,
    shouldSkipProfile: boolean,
  ): Promise<LearnerHomeResponseDto> {
    const [
      streak,
      totalXp,
      continueLearning,
      myCourses,
      notifications,
      userProfile,
    ] = await Promise.all([
      this.getStreak(userId).catch((error) => {
        this.logger.error(`Failed to get streak for user ${userId}: ${error.message}`);
        return { currentStreak: 0 };
      }),
      this.getTotalXp(userId).catch((error) => {
        this.logger.error(`Failed to get total XP for user ${userId}: ${error.message}`);
        return 0;
      }),
      this.getLatestLearn(userId).catch((error) => {
        this.logger.error(`Failed to get latest learn for user ${userId}: ${error.message}`);
        return null;
      }),
      this.getMyCourses(userId).catch((error) => {
        this.logger.error(`Failed to get my courses for user ${userId}: ${error.message}`);
        return [];
      }),
      this.getNotifications(userId).catch((error) => {
        this.logger.error(`Failed to get notifications for user ${userId}: ${error.message}`);
        return { unreadCount: 0 };
      }),
      !shouldSkipProfile
        ? this.getUserProfileFromAuth(authorization).catch((error) => {
          this.logger.error(`Failed to get user profile from auth: ${error.message}`);
          return null;
        })
        : null,
    ]);

    const isNewUser = continueLearning === null && myCourses.length === 0;
    const recommendations = await this.getRecommendations(isNewUser).catch(
      () => ({ courses: [] }),
    );

    return {
      header: {
        userId,
        avatarUrl: userProfile?.avatarUrl ?? null,
        xp: totalXp,
        streakDays: streak.currentStreak,
      },
      continueLearning,
      myCourses,
      notifications,
      recommendations,
    };
  }

  private async getRecommendationsWithoutCache(isNewUser: boolean) {
    const take = 4;  

    const recommendedCourses = await this.courseRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.course_levels', 'level')
      .leftJoinAndSelect('level.level_chapters', 'chapter', 'chapter.isPublished = :published', { published: true })
      .where('course.isPublished = :published', { published: true })
      .orderBy(isNewUser ? 'course.createdAt' : 'course.updatedAt', 'DESC')
      .take(take)
      .getMany();

    const courses = recommendedCourses.map((course) => {
      const totalChapters = course.course_levels?.reduce((sum, level) => 
        sum + (level.level_chapters?.length || 0), 0) || 0;

      return {
        course_id: course.course_id,
        course_title: course.course_title,
        reason: isNewUser ? 'คอร์สใหม่ล่าสุด' : 'คอร์สยอดนิยม',
        course_imageUrl: course.course_imageUrl ?? null,
        level_name: 'ระดับพื้นฐาน',
        course_totalChapter: totalChapters,  
      };
    });

    return { courses };
  }

  async getLatestLearn(userId: string) {
    const result = await this.lessonProgressRepository
      .createQueryBuilder('lesson_progress')
      .leftJoin('lesson_progress.lesson', 'lesson')
      .leftJoin('lesson.chapter', 'chapter')
      .leftJoin('chapter.level', 'level')
      .leftJoin('level.course', 'course')

      .where('lesson_progress.userId = :userId', { userId })
      .andWhere('lesson.is_published = true')
      .andWhere('chapter.is_published = true')

      .select('course.course_id', 'course_id')
      .addSelect('course.course_title', 'course_title')
      .addSelect('chapter.chapter_title', 'chapter_title')
      .addSelect('level.level_title', 'level_name')

      .addSelect(
        `
      ROUND(
        (
          SELECT COUNT(*)
          FROM progress lp2
          JOIN lessons l2 ON lp2.lesson_id = l2.lesson_id
          WHERE l2.chapter_id = chapter.chapter_id
          AND lp2.user_id = :userId
          AND lp2.status = 'COMPLETED'
        ) * 100.0 /
        (
          SELECT COUNT(*)
          FROM lessons l
          WHERE l.chapter_id = chapter.chapter_id
          AND l.is_published = true
        )
      ,2)
    `,
        'progressPercent',
      )

      .groupBy('course.course_id')
      .addGroupBy('course.course_title')
      .addGroupBy('chapter.chapter_title')
      .addGroupBy('chapter.chapter_id')
      .addGroupBy('level.level_title')
      .orderBy('MAX(lesson_progress.updated_at)', 'DESC')
      .setParameter('userId', userId)
      .limit(1)
      .getRawOne();

    return result;
  }
}
