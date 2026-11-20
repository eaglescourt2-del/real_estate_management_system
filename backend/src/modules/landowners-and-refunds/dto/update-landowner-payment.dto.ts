import {
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentChannel } from '@prisma/client';

export class UpdateLandownerPaymentDto {
  @ApiPropertyOptional({ example: 100000.0, description: 'Updated payment amount in GHS' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 100000.0, description: 'Alias for amount' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountPaid?: number;

  @ApiPropertyOptional({
    enum: PaymentChannel,
    example: PaymentChannel.BANK_TRANSFER,
    description: 'Payment channel',
  })
  @IsOptional()
  @IsEnum(PaymentChannel)
  paymentChannel?: PaymentChannel;

  @ApiPropertyOptional({ example: 'GIP-20261105-098231', description: 'Bank transfer reference or MoMo ID' })
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

  @ApiPropertyOptional({ example: 'CHQ-890214', description: 'Cheque number' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: '2026-11-16T10:00:00Z', description: 'Disbursement date' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Updated payment remarks', description: 'Transaction remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Updated notes', description: 'Alias for remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}
