import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetLibraryController } from './asset-library.controller';
import { JwtAuthGuard, RolesGuard } from '@auth';
import { StorageModule } from '../storage/storage.module';
import { AssetLibraryService } from './asset-library.service';
import { AssetMedia } from './entities/asset-media.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssetMedia]), StorageModule],
  controllers: [AssetLibraryController],
  providers: [AssetLibraryService, JwtAuthGuard, RolesGuard],
})
export class AssetLibraryModule {}
