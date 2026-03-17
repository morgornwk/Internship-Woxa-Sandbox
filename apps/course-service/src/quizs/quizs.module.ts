import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthLibModule } from '@auth';

import { Chapter } from '../chapters/entities/chapter.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { QuizService } from './quiz.service';

import { QuizAdminController } from './quiz-admin.controller';
import { QuizStudentController } from './quiz-student.controller';
import { CheckpointAdminController } from './checkpoint-admin.controller';
import { CheckpointStudentController } from './checkpoint-student.controller';

import { Quizs } from './entities/quizs.entity';
import { QuizsCheckpoint } from './entities/checkpoint.entity';
import { QuizsResult } from './entities/quizs-result.entity';
import { UserXp } from './entities/user-xp.entity';

@Module({
  imports: [
    AuthLibModule,
    TypeOrmModule.forFeature([
      Chapter,
      Lesson,
      Quizs,
      QuizsCheckpoint,
      QuizsResult,
      UserXp,
    ]),
  ],
  controllers: [
    QuizAdminController,
    QuizStudentController,
    CheckpointAdminController,
    CheckpointStudentController,
  ],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizsModule {}
