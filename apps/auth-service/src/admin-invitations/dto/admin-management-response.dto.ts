import { ApiProperty } from '@nestjs/swagger';

export class SuspendUserResponseDto {
  @ApiProperty({
    description: 'ID ของผู้ใช้ที่ถูกระงับ',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'สถานะใหม่ของผู้ใช้',
    example: 'suspend',
  })
  status: string;

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
    description: 'บทบาทของผู้ใช้',
    example: 'ADMIN',
  })
  role: string;
}

export class DeleteUserResponseDto {
  @ApiProperty({
    description: 'ข้อความยืนยันการลบผู้ใช้',
    example: 'User deleted successfully',
  })
  message: string;
}

export class CancelInvitationResponseDto {
  @ApiProperty({
    description: 'ข้อความยืนยันการยกเลิกคำเชิญ',
    example: 'Invitation canceled successfully',
  })
  message: string;
}
