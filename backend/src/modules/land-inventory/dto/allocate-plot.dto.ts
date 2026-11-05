import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AllocationType } from '@prisma/client';

export class AllocatePlotDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ enum: AllocationType, example: AllocationType.FULL_PLOT })
  @IsEnum(AllocationType)
  allocationType: AllocationType;

  @ApiProperty({ example: 45000.0, description: 'Agreed final purchase price in GHS' })
  @IsNumber()
  @IsPositive()
  agreedPrice: number;

  @ApiProperty({ example: 10000.0, description: 'Initial deposit required in GHS' })
  @IsNumber()
  @Min(0)
  depositRequired: number;

  @ApiPropertyOptional({ example: 6, description: 'Repayment period in months (1 = outright)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  paymentPlanMonths?: number = 1;

  @ApiPropertyOptional({ description: 'Assigned sales agent UUID (defaults to current user if agent)' })
  @IsOptional()
  @IsString()
  salesAgentId?: string;
}

