import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'StrongPassword123',
    description:
      'Password must be 12-64 characters, ASCII only, include uppercase, lowercase and number',
  })
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\x21-\x7E]{12,64}$/, {
    message:
      'Password must be 12-64 ASCII characters, include uppercase, lowercase and number, and contain no whitespace or non-English characters',
  })
  password: string;

  @ApiProperty({
    example: 'skllr',
    description: 'First name of the user',
    required: false,
  })
  @IsString()
  @Matches(/^[\p{L}\p{M} '\-]+$/u, {
    message:
      'First name may contain letters (all languages), spaces, hyphens and apostrophes only',
  })
  @MinLength(1)
  @MaxLength(64)
  firstName: string;

  @ApiProperty({
    example: 'test',
    description: 'Last name of the user',
    required: false,
  })
  @IsString()
  @Matches(/^[\p{L}\p{M} '\-]+$/u, {
    message:
      'Last name may contain letters (all languages), spaces, hyphens and apostrophes only',
  })
  @MinLength(1)
  @MaxLength(64)
  lastName: string;
}
