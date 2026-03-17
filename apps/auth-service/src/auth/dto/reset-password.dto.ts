import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abc123...',
    description: 'Reset token received after OTP verification',
  })
  @IsString()
  resetToken: string;

  @ApiProperty({
    example: 'NewStrongPassword123',
    description: 'New password for the user',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter, and one number',
  })
  @Matches(/^\S+$/, { message: 'Password must not contain whitespace' })
  newPassword: string;
}
