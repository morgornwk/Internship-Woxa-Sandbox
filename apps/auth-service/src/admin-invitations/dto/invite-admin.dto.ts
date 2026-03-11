import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteAdminDto {
  @ApiProperty({
    description: 'อีเมลของผู้ที่ต้องการเชิญให้เป็น admin',
    example: 'admin@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'ชื่อจริง (ไม่จำเป็นถ้ามีอยู่แล้ว)',
    example: 'สมชาย',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'นามสกุล (ไม่จำเป็นถ้ามีอยู่แล้ว)',
    example: 'ใจดี',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'ความรับผิดชอบของ admin (แสดงในอีเมลเชิญ)',
    example: 'จัดการคอร์สและผู้ใช้',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  responsibility?: string;
}
