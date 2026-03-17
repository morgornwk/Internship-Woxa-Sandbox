import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsISO8601 } from 'class-validator';

export class TestBumpDto {
  @ApiProperty({
    example: '2025-01-01T10:00:00.000Z',
    description: 'วันที่สำหรับทดสอบ (ISO 8601 format)',
    format: 'date-time',
  })
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  date: string;
}
