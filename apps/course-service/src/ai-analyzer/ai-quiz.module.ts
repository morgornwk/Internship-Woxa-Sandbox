import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthLibModule } from '@auth';

import { AiQuizService } from './ai-quiz.service';
import { AiQuizAdminController } from './ai-quiz-admin.controller';

import { AiQuizGeneration } from './entities/ai-analyzer-entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Quizs } from '../quizs/entities/quizs.entity';
import { Article } from '../articles/entities/article.entity';

@Module({
  imports: [
    AuthLibModule,
    TypeOrmModule.forFeature([Lesson, Quizs, AiQuizGeneration, Article]),
  ],
  controllers: [AiQuizAdminController],
  providers: [AiQuizService],
  exports: [AiQuizService],
})
export class AiQuizModule {}
