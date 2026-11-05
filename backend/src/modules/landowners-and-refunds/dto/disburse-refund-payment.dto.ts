import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentChannel } from '@prisma/client';

export class DisburseRefundPaymentDto {
  @ApiProperty({ example: 15000.0, description: 'Amount disbursed to customer in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.MOBILE_MONEY_MTN,
    description: 'Selected external payment channel: MOBILE_MONEY_MTN, MOBILE_MONEY_TELECEL, BANK_TRANSFER, CASH, CHEQUE',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: 'MTN-REFUND-9081239', description: 'External transaction ID, bank reference, or cheque number' })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({ example: 'First tranche of approved net refund' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-11-05T11:00:00Z', description: 'Disbursement date' })
  @IsOptional()
  @IsDateString()
  disbursementDate?: string;
}
