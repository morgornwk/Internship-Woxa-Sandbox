import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
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
  private static readonly HOME_TTL_SECONDS = 120;
  private static readonly RECOMMENDATIONS_TTL_SECONDS = 300;
  private static readonly CACHE_VERSION = 'v3';

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
  ) { }

  async getHome(
    userId: string,
    authorization?: string,
    internalCall?: string,
  ): Promise<LearnerHomeResponseDto> {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const shouldSkipProfile = internalCall === 'true';

    // ข้อมูลความคืบหน้าต่างๆ ควรเป็น Real-time จะได้ไม่อัปเดตช้า (ดีเลย์)
    return this.buildHomeResponse(userId, authorization, shouldSkipProfile);
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

  // ดึงข้อมูล total XP ของผู้ใช้จากฐานข้อมูล UserXp จากค่า xpTotal ล่าสุด เพื่อให้รองรับการหักคะแนนตอนแลกของรางวัล
  private async getTotalXp(userId: string) {
    const latest = await this.userXpRepository.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    if (latest && typeof latest.xpTotal === 'number') {
      return latest.xpTotal;
    }

    const result = await this.userXpRepository
      .createQueryBuilder('ux')
      .select('COALESCE(SUM(ux.xpEarned), 0)', 'total')
      .where('ux.userId = :userId', { userId })
      .getRawOne<{ total: string }>();

    return Number(result?.total ?? 0);
  }

  private resolveRoadmapLessonPublishedState(
    lesson: { lesson_type: string; lesson_videoUrl?: string | null; isPublished: boolean },
  ): boolean {
    if (lesson.lesson_type === 'video') {
      return Boolean(lesson.lesson_videoUrl?.trim());
    }
    return lesson.isPublished === true;
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
      .leftJoinAndSelect(
        'level.level_chapters',
        'chapter',
        'chapter.isPublished = :chapterPublished',
        { chapterPublished: true },
      )
      .leftJoinAndSelect('chapter.lessons', 'lesson')
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
      let sumProgress = 0;

      for (const level of course.course_levels || []) {
        for (const chapter of level.level_chapters || []) {
          if (!chapter.isPublished) continue;

          for (const lesson of chapter.lessons || []) {
            if (!this.resolveRoadmapLessonPublishedState(lesson as any)) continue;

            totalLessons++;

            const progress = progressMap.get(lesson.lesson_id.toString());
            if (progress) {
              if (
                progress.status === 'COMPLETED' ||
                progress.status === 'SKIPPED'
              ) {
                sumProgress += 100;
              } else if (
                progress.progressPercent != null &&
                !Number.isNaN(Number(progress.progressPercent))
              ) {
                sumProgress += Math.round(Number(progress.progressPercent));
              }
            }
          }
        }
      }

      if (totalLessons > 0) {
        courseProgressMap.set(course.course_id, {
          title: course.course_title,
          progressPercent: Math.round(sumProgress / totalLessons),
        });
      }
    }

    return courseProgressMap;
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
    const cacheKey = `learner-home:${LearnerHomeService.CACHE_VERSION}:recommendations:${isNewUser ? 'new' : 'active'}`;

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
      this.getStreak(userId).catch(() => ({ currentStreak: 0 })),
      this.getTotalXp(userId).catch(() => 0),
      this.getLatestLearn(userId).catch(() => null),
      this.getMyCourses(userId).catch(() => []),
      this.getNotifications(userId).catch(() => ({ unreadCount: 0 })),
      !shouldSkipProfile
        ? this.getUserProfileFromAuth(authorization).catch(() => null)
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

    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .orderBy(isNewUser ? 'course.createdAt' : 'course.updatedAt', 'DESC')
      .take(take)
      .getMany();

    // Get chapter counts for each course
    const courseIds = courses.map(c => c.course_id);

    const chapterCounts = await this.courseRepository
      .createQueryBuilder('course')
      .select('course.course_id', 'course_id')
      .addSelect('COUNT(ch.chapter_id)', 'course_totalChapter')
      .innerJoin('levels', 'l', 'l.course_id = course.course_id')
      .innerJoin('chapters', 'ch', 'ch.level_id = l.level_id AND ch.is_published = true')
      .where('course.course_id IN (:...courseIds)', { courseIds })
      .groupBy('course.course_id')
      .getRawMany();

    const countMap = new Map(
      chapterCounts.map(cc => [cc.course_id, Number(cc.course_totalChapter) || 0])
    );

    const result = courses.map(course => ({
      course_id: course.course_id,
      course_title: course.course_title,
      reason: isNewUser ? 'คอร์สใหม่ล่าสุด' : 'คอร์สยอดนิยม',
      course_imageUrl: course.course_imageUrl ?? null,
      level_name: 'ระดับพื้นฐาน',
      course_totalChapter: countMap.get(course.course_id) || 0,
    }));

    return { courses: result };
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
        COALESCE(
          (
            SELECT SUM(
              CASE 
                WHEN lp2.status IN ('COMPLETED', 'SKIPPED') THEN 100
                ELSE COALESCE(lp2.progress_percent, 0)
              END
            )
            FROM lessons l2
            LEFT JOIN progress lp2 ON lp2.lesson_id = l2.lesson_id AND lp2.user_id = :userId
            WHERE l2.chapter_id = chapter.chapter_id
            AND (l2.is_published = true OR (l2.lesson_type = 'video' AND l2.lesson_video_url IS NOT NULL AND TRIM(l2.lesson_video_url) != ''))
          ) / 
          NULLIF((
            SELECT COUNT(*)
            FROM lessons l
            WHERE l.chapter_id = chapter.chapter_id
            AND (l.is_published = true OR (l.lesson_type = 'video' AND l.lesson_video_url IS NOT NULL AND TRIM(l.lesson_video_url) != ''))
          ), 0)
        , 0)
      )
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