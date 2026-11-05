import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeductionItemDto {
  @ApiProperty({ example: 'Administrative & Processing Fee' })
  @IsString()
  @IsNotEmpty()
  deductionName: string;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: '5% statutory administrative deduction as stipulated in land agreement terms' })
  @IsString()
  @IsNotEmpty()
  explanation: string;
}

export class CreateRefundRequestDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Plot UUID associated with allocation' })
  @IsString()
  @IsNotEmpty()
  plotId: string;

  @ApiProperty({
    example: 'Customer relocating overseas and unable to continue monthly instalment schedule.',
    description: 'Detailed explanation for the refund request',
  })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters.' })
  reason: string;

  @ApiPropertyOptional({ type: [DeductionItemDto], description: 'List of proposed deductions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionItemDto)
  deductions?: DeductionItemDto[];
}

