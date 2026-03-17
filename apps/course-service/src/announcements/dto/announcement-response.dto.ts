import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnnouncementResponseDto {
  @ApiProperty({ description: 'รหัสป้ายประกาศ', example: 1 })
  announcement_id: number;

  @ApiProperty({
    description: 'หัวข้อป้ายประกาศ',
    example: '🔥 เปิดคอร์สใหม่! React Advanced 2025',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'URL รูปภาพป้ายประกาศ (จาก CDN)',
    example: 'https://cdn.example.com/banners/react-course-2025.jpg',
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'ลิงก์เมื่อกดป้าย (internal path หรือ external URL)',
    example: '/courses/react-advanced-2025',
    nullable: true,
  })
  deepLink?: string | null;

  @ApiProperty({ description: 'สถานะการแสดงผล', example: true })
  activeStatus: boolean;

  @ApiProperty({ description: 'ลำดับความสำคัญ', example: 10 })
  priority: number;

  @ApiPropertyOptional({
    description: 'วันที่เริ่มแสดง',
    example: '2025-02-20T00:00:00Z',
    nullable: true,
  })
  startDate?: Date | null;

  @ApiPropertyOptional({
    description: 'วันที่สิ้นสุดการแสดง',
    example: '2025-03-20T23:59:59Z',
    nullable: true,
  })
  endDate?: Date | null;

  @ApiProperty({ description: 'วันที่สร้าง', example: '2025-02-17T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({
    description: 'วันที่อัปเดตล่าสุด',
    example: '2025-02-17T10:00:00Z',
  })
  updatedAt: Date;
}
