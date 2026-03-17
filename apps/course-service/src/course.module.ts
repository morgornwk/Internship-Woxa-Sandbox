import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '@config/database.config';
import { AuthLibModule } from '@auth/auth-lib.module';

// Modules
import { AnnouncementsModule } from './announcements/announcements.module';

// Controllers
import { AdminCoursesController } from './courses/courses-admin.controller';
import { LevelsAdminController } from './levels/levels-admin.controller';
import { LevelsStudentController } from './levels/levels-student.controller';
import { ChaptersAdminController } from './chapters/chapters-admin.controller';
import { ChaptersStudentController } from './chapters/chapters-student.controller';
import { LessonsAdminController } from './lessons/lessons-admin.controller';
import { LessonsStudentController } from './lessons/lessons-student.controller';
import { ArticlesAdminController } from './articles/articles-admin.controller';
import { ArticlesStudentController } from './articles/articles-student.controller';
import { ProgressController } from './progress/progress.controller';
import { StreakController } from './streaks/streak.controller';
import { StudentCoursesController } from './courses/courses-student.controller';

// Services
import { CoursesService } from './courses/courses.service';
import { LevelsService } from './levels/levels.service';
import { ChaptersService } from './chapters/chapters.service';
import { LessonsService } from './lessons/lessons.service';
import { ArticlesService } from './articles/articles.service';
import { StorageModule } from './storage/storage.module';
import { MediaImagesModule } from './media-images/media-images.module';
import { MediaVideosModule } from './media-videos/media-videos.module';
import { AssetLibraryModule } from './asset-library/asset-library.module';
import { ProgressService } from './progress/progress.service';
import { StreakService } from './streaks/streak.service';
import { LearnerHomeModule } from './learner-home/learner-home.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuizsModule } from './quizs/quizs.module';
import { AiQuizModule } from './ai-analyzer/ai-quiz.module';
import { AppRedisCacheModule } from './cache/app-redis-cache.module';

// Entities
import { Course } from './courses/entities/course.entity';
import { Level } from './levels/entities/level.entity';
import { Chapter } from './chapters/entities/chapter.entity';
import { Lesson } from './lessons/entities/lesson.entity';
import { Article } from './articles/entities/article.entity';
import { LessonProgress } from './progress/entities/progress.entity';
import { UserStreak } from './streaks/entities/user-streak.entity';
import { Announcement } from './announcements/entities/announcement.entity';
import { VideoAsset } from './media-videos/entities/video.entity';
import { Quizs } from './quizs/entities/quizs.entity';
import { QuizsCheckpoint } from './quizs/entities/checkpoint.entity';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/course-service/.env', '.env'],
    }),
    AppRedisCacheModule,
    ScheduleModule.forRoot(),

    ...(isTest
      ? []
      : [
          TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: getDatabaseConfig,
            inject: [ConfigService],
          }),

          TypeOrmModule.forFeature([
            Course,
            Level,
            Chapter,
            Lesson,
            Article,
            Quizs,
            QuizsCheckpoint,
            LessonProgress,
            UserStreak,
            Announcement,
            VideoAsset,
          ]),

          AuthLibModule,
          StorageModule,
          MediaImagesModule,
          MediaVideosModule,
          AssetLibraryModule,

          AnnouncementsModule,
          QuizsModule,
          AiQuizModule,
          LearnerHomeModule,
          NotificationsModule,
        ]),
  ],

  controllers: [
    AdminCoursesController,
    StudentCoursesController,
    LevelsAdminController,
    LevelsStudentController,
    ChaptersAdminController,
    ChaptersStudentController,
    LessonsAdminController,
    LessonsStudentController,
    ArticlesAdminController,
    ArticlesStudentController,
    ProgressController,
    StreakController,
  ],

  providers: [
    CoursesService,
    LevelsService,
    ChaptersService,
    LessonsService,
    ArticlesService,
    ProgressService,
    StreakService,
  ],
})
export class AppModule {}
