import { PartialType } from '@nestjs/swagger';
import { CreateCheckpointDto } from './create-quizs-checkpoint.dto';

export class UpdateCheckpointDto extends PartialType(CreateCheckpointDto) {}
