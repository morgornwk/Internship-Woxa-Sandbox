import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { AuthAccount } from './entities/auth-account.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersAdminController } from './users-admin.controller';
import { AdminInvitation } from '../admin-invitations/entities/admin-invitation.entity';

// import course entities
import { Course } from 'apps/course-service/src/courses/entities/course.entity';
import { Level } from 'apps/course-service/src/levels/entities/level.entity';
import { Chapter } from 'apps/course-service/src/chapters/entities/chapter.entity';
import { Lesson } from 'apps/course-service/src/lessons/entities/lesson.entity';
import { Article } from 'apps/course-service/src/articles/entities/article.entity';
import { LessonProgress } from 'apps/course-service/src/progress/entities/progress.entity';
import { UserStreak } from 'apps/course-service/src/streaks/entities/user-streak.entity';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';

import { WebsocketModule } from '../gateway/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthAccount, AdminInvitation], 'auth'),
    TypeOrmModule.forFeature([Course, Level, Chapter, Lesson, Article, LessonProgress, UserStreak, UserXp], 'course'),
    HttpModule,
    ConfigModule,
    forwardRef(() => AuthModule),
    WebsocketModule,
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
