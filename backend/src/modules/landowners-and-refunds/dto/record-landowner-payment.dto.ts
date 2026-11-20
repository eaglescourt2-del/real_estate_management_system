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
import { PaymentChannel } from '@prisma/client';

export class RecordLandownerPaymentDto {
  @ApiPropertyOptional({ description: 'Landowner Agreement UUID' })
  @IsOptional()
  @IsString()
  agreementId?: string;

  @ApiPropertyOptional({ description: 'Land Location UUID (if recording directly against a land location)' })
  @IsOptional()
  @IsString()
  landLocationId?: string;

  @ApiPropertyOptional({ example: 150000.0, description: 'Amount disbursed to landowner in GHS' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 150000.0, description: 'Alias for amount' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountPaid?: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.BANK_TRANSFER,
    description: 'Selected means of external payment: BANK_TRANSFER, MOBILE_MONEY_MTN, MOBILE_MONEY_TELECEL, MOBILE_MONEY_AT, CASH, CHEQUE',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: 'GIP-20261105-098231', description: 'Bank transfer reference, GIP reference, or MoMo ID' })
  @IsOptional()
  @IsString()
  bankTransactionRef?: string;

  @ApiPropertyOptional({ example: 'GCB Wire #92847', description: 'Alias for bankTransactionRef' })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional({ example: 'Stanbic Bank', description: 'Bank name' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'CHQ-890214', description: 'Cheque number if payment by cheque' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: 'Tranche #2 payment for boundary beacons 41-80' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Tranche payment notes', description: 'Alias for remarks' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-11-05T09:30:00Z', description: 'Disbursement date' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

