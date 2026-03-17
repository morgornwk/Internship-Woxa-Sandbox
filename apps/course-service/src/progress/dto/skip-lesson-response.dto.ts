import { ApiProperty } from '@nestjs/swagger';
import { LessonProgressResponseDto } from './lesson-progress-response.dto';

export class SkipLessonResponseDto {
  @ApiProperty({ description: 'Progress row for the skipped lesson' })
  skipped: LessonProgressResponseDto;

  @ApiProperty({
    description:
      'Progress row created/unlocked for the next lesson (null if none)',
    nullable: true,
  })
  unlockedNext: LessonProgressResponseDto | null;
}
