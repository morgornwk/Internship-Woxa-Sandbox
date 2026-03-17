import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateImageDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'lecture-1.jpg',
    description: 'Original filename',
  })
  original_filename?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'image/jpeg',
    description: 'MIME type of the image',
  })
  mime_type?: string;
}
