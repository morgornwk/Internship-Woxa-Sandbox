import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVideoDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: 'string',
    description: 'Original filename (optional)',
    example: 'sample.mp4',
  })
  original_filename?: string;

  @IsString()
  @ApiProperty({
    type: 'string',
    description: 'MIME type of the video',
    example: 'video/mp4',
  })
  mime_type: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiProperty({
    type: 'number',
    description: 'Size in bytes',
    example: 10485760,
  })
  size_bytes: number;

  // อ้างอิง record วิดีโอที่มีอยู่แล้วในระบบ เพื่ออัพโหลดไฟล์ใหม่ทับลงไป
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    type: 'number',
    description: 'Optional existing media asset id',
    example: 123,
  })
  media_asset_id?: number;
}
