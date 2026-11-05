import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncomeSourceCategory, PaymentChannel } from '@prisma/client';

export class CreateIncomeDto {
  @ApiProperty({
    enum: IncomeSourceCategory,
    example: IncomeSourceCategory.OTHER_OPERATIONAL_INCOME,
    description: 'Category: LEGAL_SURVEY_INCOME, OTHER_OPERATIONAL_INCOME',
  })
  @IsEnum(IncomeSourceCategory)
  sourceCategory: IncomeSourceCategory;

  @ApiProperty({ example: 'Client site tour bus transportation and consultation fee' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 500.0, description: 'Income amount in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.CASH,
    description: 'Selected external payment channel: CASH, MOBILE_MONEY_MTN, MOBILE_MONEY_TELECEL, BANK_TRANSFER',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: '2026-11-05T10:00:00Z', description: 'Transaction date' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

