import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminListDto {
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
    description: 'สถานะของผู้ใช้',
    example: 'active',
    enum: ['active', 'invited', 'suspend'],
  })
  status: string | null;

  @ApiProperty({
    description: 'บทบาทของผู้ใช้',
    example: 'ADMIN',
    enum: ['ADMIN', 'OWNER'],
  })
  role: string;

  @ApiPropertyOptional({
    description: 'วันที่คำเชิญหมดอายุ (ISO string)',
    example: '2026-03-15T10:30:00.000Z',
  })
  expiresAt: string | null;

  @ApiPropertyOptional({
    description: 'จำนวนชั่วโมงที่เหลือจนถึงวันหมดอายุ',
    example: 48,
    minimum: 0,
  })
  hoursUntilExpiry: number | null;
}
