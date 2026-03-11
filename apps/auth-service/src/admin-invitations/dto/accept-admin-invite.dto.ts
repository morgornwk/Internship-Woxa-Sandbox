import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptAdminInviteDto {
  @ApiProperty({
    description: 'Invitation token ที่ได้รับจากอีเมลเชิญ',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'รหัสผ่านใหม่ที่ต้องการตั้ง',
    example: 'MyNewPassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
