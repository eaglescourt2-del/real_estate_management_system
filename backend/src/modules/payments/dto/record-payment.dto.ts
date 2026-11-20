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
import { PaymentCategory, PaymentChannel } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Plot Allocation UUID' })
  @IsString()
  @IsNotEmpty()
  allocationId: string;

  @ApiProperty({ example: 10000.0, description: 'Payment amount received in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentCategory,
    example: PaymentCategory.INSTALMENT,
    description: 'Category: INITIAL_DEPOSIT, INSTALMENT, FULL_OUTRIGHT, RESERVATION_FEE, LEGAL_DOCUMENTATION_FEE, SURVEY_INDENTURE_FEE',
  })
  @IsEnum(PaymentCategory)
  paymentCategory: PaymentCategory;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.MOBILE_MONEY_MTN,
    description: 'Ghanaian payment channels: MOBILE_MONEY_MTN, MOBILE_MONEY_TELECEL, MOBILE_MONEY_AT, BANK_TRANSFER, BANK_DIRECT_DEPOSIT, CASH, CHEQUE, CARD_PAYSTACK, CARD_FLUTTERWAVE',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: 'GCB Bank / Stanbic / Ecobank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'High Street Branch, Accra' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({ example: 'CHQ-984012' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: 'MTN-9481029482', description: 'External gateway reference or MoMo Transaction ID' })
  @IsOptional()
  @IsString()
  externalGatewayRef?: string;

  @ApiPropertyOptional({ example: '/uploads/documents/bank-deposit-slip-1.pdf', description: 'URL of uploaded deposit slip' })
  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;

  @ApiPropertyOptional({ example: '2026-11-05T10:00:00Z', description: 'Date payment was received (defaults to now)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Received at Accra Head Office', description: 'Transaction notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

