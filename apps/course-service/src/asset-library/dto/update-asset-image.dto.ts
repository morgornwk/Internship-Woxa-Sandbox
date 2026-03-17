import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssetMediaStatus } from '../entities/asset-media.entity';

export class UpdateAssetImageDto {
  @ApiProperty({ example: 'original_filename.jpg', required: false })
  @IsOptional()
  @IsString()
  original_filename?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsOptional()
  @IsString()
  public_url?: string;

  @ApiProperty({
    example: AssetMediaStatus.READY,
    enum: AssetMediaStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetMediaStatus)
  status?: AssetMediaStatus;
}
