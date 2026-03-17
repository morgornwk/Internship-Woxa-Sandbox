import { ApiProperty } from '@nestjs/swagger';

export class CreateRewardAdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  image_url: string;

  @ApiProperty()
  required_points: number;

  @ApiProperty()
  remain: number;

  @ApiProperty()
  redeem_start_date: Date;

  @ApiProperty()
  redeem_end_date: Date;

  @ApiProperty()
  limit_per_user: number;

  @ApiProperty()
  total_limit: number;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;

  constructor(partial: Partial<CreateRewardAdminResponseDto>) {
    Object.assign(this, partial);
  }
}
