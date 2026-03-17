import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as path from 'path';

// Import feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WebsocketModule } from './gateway/websocket.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminInvitationsModule } from './admin-invitations/admin-invitations.module';

// Import course entities
import { Course } from 'apps/course-service/src/courses/entities/course.entity';
import { Level } from 'apps/course-service/src/levels/entities/level.entity';
import { Chapter } from 'apps/course-service/src/chapters/entities/chapter.entity';
import { Lesson } from 'apps/course-service/src/lessons/entities/lesson.entity';
import { Article } from 'apps/course-service/src/articles/entities/article.entity';
import { LessonProgress } from 'apps/course-service/src/progress/entities/progress.entity';
import { UserStreak } from 'apps/course-service/src/streaks/entities/user-streak.entity';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';
import { Quizs } from 'apps/course-service/src/quizs/entities/quizs.entity';
import { QuizsCheckpoint } from 'apps/course-service/src/quizs/entities/checkpoint.entity';
import { RewardRedemption } from 'apps/reward-service/src/reward/entities/reward-redemption';
import { Reward } from 'apps/reward-service/src/reward/entities/rewards.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), 'apps/auth-service/.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      name: 'auth',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'course',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('COURSE_DATABASE_URL'),
        entities: [
          Course,
          Level,
          Chapter,
          Lesson,
          Article,
          LessonProgress,
          UserStreak,
          UserXp,
          Quizs,
          QuizsCheckpoint,
        ],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'reward',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('REWARD_DATABASE_URL'),
        entities: [RewardRedemption, Reward],
        synchronize: false,
      }),
    }),

    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    AdminInvitationsModule,
    AnalyticsModule,
    WebsocketModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AuthAppModule {}
