import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'หัวข้อป้ายประกาศ',
    example: '🔥 เปิดคอร์สใหม่! React Advanced 2025',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'URL รูปภาพป้ายประกาศ (จาก CDN)',
    example: 'https://cdn.example.com/banners/react-course-2025.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'ลิงก์เมื่อกดป้าย (internal path หรือ external URL)',
    example: '/courses/react-advanced-2025',
  })
  @IsString()
  @IsOptional()
  deepLink?: string;

  @ApiPropertyOptional({
    description: 'สถานะการแสดงผล',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  activeStatus?: boolean;

  @ApiPropertyOptional({
    description: 'ลำดับความสำคัญ (ยิ่งสูงยิ่งอยู่บน)',
    example: 10,
    minimum: 0,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description: 'วันที่เริ่มแสดง (ISO 8601)',
    example: '2025-02-20T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'วันที่สิ้นสุดการแสดง (ISO 8601)',
    example: '2025-03-20T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
