import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@common/enums/status.enum';

export class UpdateUserDto {
  @ApiProperty({ example: 'skllr' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'test' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @ApiProperty({ 
    example: 'active',
    enum: Status,
    required: false
  })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
