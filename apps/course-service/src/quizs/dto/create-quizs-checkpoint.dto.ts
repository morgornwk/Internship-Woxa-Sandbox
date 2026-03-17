import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { toInt, toStringArray, toString } from './transformers';

const QuizType = ['multiple_choice', 'true_false'] as const;
type QuizType = (typeof QuizType)[number];

export class CreateCheckpointDto {
  @ApiProperty({ example: 1 })
  @Transform(toInt)
  @IsInt()
  lesson_id: number;

  @ApiProperty({ enum: QuizType, example: 'multiple_choice' })
  @IsEnum(QuizType)
  checkpoint_type: QuizType;

  @ApiProperty({ example: '1 + 1 = ?' })
  @IsString()
  @IsNotEmpty()
  checkpoint_questions: string;

  @ApiPropertyOptional({ type: [String], example: ['1', '2', '3'] })
  @ValidateIf(
    (object: { checkpoint_type?: QuizType }) =>
      object.checkpoint_type === 'multiple_choice',
  )
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  checkpoint_option?: string[];

  @ApiProperty({ example: '2' })
  @Transform(toString)
  @IsString()
  @IsNotEmpty()
  checkpoint_answer: string;

  @ApiPropertyOptional({ example: 'คำอธิบาย/เฉลยของ checkpoint' })
  @IsOptional()
  @IsString()
  checkpoint_explanation?: string;
}
