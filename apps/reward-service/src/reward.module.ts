import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthLibModule } from '@auth/auth-lib.module';
import { RewardModule } from './reward/reward.module';
import * as path from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './reward-admin/reward-admin.module';
import { UserXp } from 'apps/course-service/src/quizs/entities/user-xp.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), 'apps/reward-service/.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      name: 'reward',
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
        entities: [UserXp],
        synchronize: false,
      }),
    }),

    AuthLibModule,
    RewardModule,
    AdminModule,
  ],
})
export class RewardAppModule {}
