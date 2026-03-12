import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
// import { RedemptionType } from '../../reward/entities/rewards.entity';

export class CreateRewardAdminDto {
  @ApiProperty({ example: 'Starbucks Voucher' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Get free coffee' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  required_points: number;

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  @IsDateString()
  redeem_start_date: Date;

  @ApiProperty({ example: '2026-12-31T23:59:59Z' })
  @IsDateString()
  redeem_end_date: Date;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit_per_user: number;

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  total_limit: number;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active: boolean;
}
