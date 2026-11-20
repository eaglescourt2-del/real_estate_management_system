import { PartialType } from '@nestjs/swagger';
import { CreateLandLocationDto } from './create-location.dto';

export class UpdateLandLocationDto extends PartialType(CreateLandLocationDto) {}

