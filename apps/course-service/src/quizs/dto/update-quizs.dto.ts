import { PartialType } from '@nestjs/swagger';
import { CreateQuizsDto } from './create-quizs.dto';

export class UpdateQuizsDto extends PartialType(CreateQuizsDto) {}
