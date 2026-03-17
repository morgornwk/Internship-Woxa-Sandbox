import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

import { VideoAssetStatus } from '../entities/video.entity';

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'lecture-1.mp4',
    description: 'Original filename',
  })
  original_filename?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'video/mp4',
    description: 'MIME type of the video',
  })
  mime_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 10485760, description: 'Size in bytes' })
  size_bytes?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'my-bucket', description: 'Storage bucket' })
  storage_bucket?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'videos/3f8c2b7f-9c3f-4b2f.mp4',
    description: 'Storage key',
  })
  storage_key?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/videos/abc.mp4',
    description: 'Public URL (optional)',
  })
  public_url?: string;

  @IsOptional()
  @IsEnum(VideoAssetStatus)
  @ApiPropertyOptional({
    enum: VideoAssetStatus,
    example: VideoAssetStatus.READY,
    description: 'Asset status',
  })
  status?: VideoAssetStatus;
}
