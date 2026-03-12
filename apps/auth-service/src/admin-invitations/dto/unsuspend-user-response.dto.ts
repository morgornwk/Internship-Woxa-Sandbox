import { ApiProperty } from '@nestjs/swagger';

export class UnsuspendUserResponseDto {
  @ApiProperty({
    description: 'ID ของผู้ใช้ที่ถูกปลดระงับ',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'สถานะใหม่ของผู้ใช้',
    example: 'active',
    enum: ['active', 'invited', 'suspend'],
  })
  status: string;

  @ApiProperty({
    description: 'ข้อความยืนยันการปลดระงับผู้ใช้',
    example: 'User unsuspended successfully',
  })
  message: string;
}
