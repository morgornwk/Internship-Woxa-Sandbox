import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserListDto {
  @ApiProperty({
    description: 'ID ของผู้ใช้',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'อีเมลของผู้ใช้',
    example: 'admin@example.com',
    required: false,
  })
  email: string | null;

  @ApiProperty({
    description: 'รูป avatar ของผู้ใช้',
    example: 'https://cdn.skllracademy.com/images/default-avatar.jpg',
  })
  avatar: string;

  @ApiProperty({
    description: 'ชื่อของผู้ใช้',
    example: 'สมชาย',
    required: false,
  })
  firstName: string | null;

  @ApiProperty({
    description: 'นามสกุลของผู้ใช้',
    example: 'ใจดี',
    required: false,
  })
  lastName: string | null;

  @ApiProperty({
    description: 'บทบาทของผู้ใช้',
    example: 'ADMIN',
    enum: ['ADMIN', 'OWNER', 'STUDENT'],
  })
  role: string;

  @ApiProperty({
    description: 'สถิติ streak ปัจจุบัน',
    example: 5,
    minimum: 0,
  })
  streak: number;

  @ApiProperty({
    description: 'สถานะออนไลน์',
    example: true,
  })
  status: boolean;

  @ApiPropertyOptional({
    description: 'วันที่คำเชิญหมดอายุ (ISO string) - สำหรับ admin เท่านั้น',
    example: '2026-03-15T10:30:00.000Z',
  })
  expiresAt: string | null;

  @ApiPropertyOptional({
    description: 'จำนวนชั่วโมงที่เหลือจนถึงวันหมดอายุ - สำหรับ admin เท่านั้น',
    example: 48,
    minimum: 0,
  })
  hoursUntilExpiry: number | null;
}
