import {
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentCategory, PaymentChannel } from '@prisma/client';

export class UpdatePaymentDto {
  @ApiPropertyOptional({ example: 15000.0, description: 'Updated payment amount in GHS' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    enum: PaymentCategory,
    example: PaymentCategory.INSTALMENT,
    description: 'Category: INITIAL_DEPOSIT, INSTALMENT, FULL_OUTRIGHT, RESERVATION_FEE',
  })
  @IsOptional()
  @IsEnum(PaymentCategory)
  paymentCategory?: PaymentCategory;

  @ApiPropertyOptional({
    enum: PaymentChannel,
    example: PaymentChannel.MOBILE_MONEY_MTN,
    description: 'Payment channel',
  })
  @IsOptional()
  @IsEnum(PaymentChannel)
  paymentChannel?: PaymentChannel;

  @ApiPropertyOptional({ example: 'GCB Bank / Stanbic' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'High Street Branch' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({ example: 'CHQ-984012' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: 'MTN-9481029482', description: 'External reference or MoMo Transaction ID' })
  @IsOptional()
  @IsString()
  externalGatewayRef?: string;

  @ApiPropertyOptional({ example: '2026-11-16T10:00:00Z', description: 'Payment date' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Updated payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
