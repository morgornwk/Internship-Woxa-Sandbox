import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaImagesController } from './media-images.controller';
import { MediaImagesService } from './media-images.service';
import { ImageAsset } from './entities/image.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ImageAsset]), StorageModule],
  controllers: [MediaImagesController],
  providers: [MediaImagesService],
  exports: [MediaImagesService],
})
export class MediaImagesModule {}
