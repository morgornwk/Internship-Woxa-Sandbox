import { ApiProperty } from '@nestjs/swagger';
import { StreakColor } from './streak-color.dto';

export class StreakResponseDto {
  @ApiProperty({
    example: 7,
    description: 'จำนวนวันที่ทำสำเร็จสะสม (ไม่ reset เมื่อขาดวัน)',
  })
  currentStreak: number;

  @ApiProperty({
    example: 30,
    description: 'สถิติสูงสุดตลอดเวลา (เท่ากับ currentStreak)',
  })
  longestStreak: number;

  @ApiProperty({
    example: '2025-01-07T10:30:00.000Z',
    nullable: true,
    description: 'เวลา UTC ของการ completion/skip ครั้งล่าสุดที่นับ',
  })
  lastCompletedAt: Date | null;

  @ApiProperty({
    example: 'orange',
    nullable: true,
    description:
      'สีตามช่วงวัน: yellow (3+), orange (10+), red (30+), pink (100+), purple (200+)',
    enum: ['yellow', 'orange', 'red', 'pink', 'purple'],
  })
  color: StreakColor | null;

  @ApiProperty({
    example: true,
    description: 'ทำสำเร็จวันนี้แล้ว และยังไม่เคยแสดง reward modal วันนี้',
  })
  isReward: boolean;

  @ApiProperty({
    example: true,
    description:
      'สถานะไฟ streak: true ถ้าทำวันนี้หรือเมื่อวาน (UTC), false ถ้าขาดมากกว่า 1 วัน',
  })
  isFlameOn: boolean;
}
