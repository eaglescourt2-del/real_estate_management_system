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
import { ExpenseCategoryCode, PaymentChannel } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({
    enum: ExpenseCategoryCode,
    example: ExpenseCategoryCode.SITE_DEVELOPMENT_SURVEY,
    description:
      'Category: STAFF_SALARY_ALLOWANCE, MARKETING_ADVERTISING, TRANSPORTATION_FUEL, OFFICE_RENT_UTILITIES, LEGAL_DOCUMENTATION, SITE_DEVELOPMENT_SURVEY, ADMINISTRATIVE_EXPENSE, OTHER_OPERATIONAL',
  })
  @IsEnum(ExpenseCategoryCode)
  categoryCode: ExpenseCategoryCode;

  @ApiProperty({ example: 'Bulldozer grading and road opening at Prampram Phase 2' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 4500.0, description: 'Expense amount in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.MOBILE_MONEY_MTN,
    description: 'Selected means of external payment: MOBILE_MONEY_MTN, MOBILE_MONEY_TELECEL, BANK_TRANSFER, CASH, CHEQUE',
  })
  @IsEnum(PaymentChannel)
  paymentChannel: PaymentChannel;

  @ApiProperty({ example: 'Agyei Earthmoving & Engineering Ltd.' })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiPropertyOptional({ description: 'Associated Land Location UUID if site-specific' })
  @IsOptional()
  @IsString()
  landLocationId?: string;

  @ApiPropertyOptional({ example: '/uploads/documents/invoice_grading_001.pdf', description: 'Supporting receipt/invoice slip' })
  @IsOptional()
  @IsString()
  supportingReceiptUrl?: string;

  @ApiPropertyOptional({ example: '2026-11-05T08:00:00Z', description: 'Expense date' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}

