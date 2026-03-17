import { Module } from '@nestjs/common';
import { RewardAdminService } from './reward-admin.service';
import { AdminController } from './reward-admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reward } from '../reward/entities/rewards.entity';
import { StorageModule } from 'apps/course-service/src/storage/storage.module';
import { RewardModule } from '../reward/reward.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward], 'reward'),
    StorageModule,
    RewardModule,
  ],
  controllers: [AdminController],
  providers: [RewardAdminService],
})
export class AdminModule {}
