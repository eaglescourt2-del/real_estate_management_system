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
  @ApiProperty({ description: 'Landowner Agreement UUID' })
  @IsString()
  @IsNotEmpty()
  agreementId: string;

  @ApiProperty({ example: 150000.0, description: 'Amount disbursed to landowner in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.BANK_TRANSFER,
    description: 'Selected means of external payment: BANK_TRANSFER, BANK_DIRECT_DEPOSIT, MOBILE_MONEY_MTN, CASH, CHEQUE',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: 'GIP-20261105-098231', description: 'Bank transfer reference, GIP reference, or MoMo ID' })
  @IsOptional()
  @IsString()
  bankTransactionRef?: string;

  @ApiPropertyOptional({ example: 'CHQ-890214', description: 'Cheque number if payment by cheque' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: 'Tranche #2 payment for boundary beacons 41-80' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: '2026-11-05T09:30:00Z', description: 'Disbursement date' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
