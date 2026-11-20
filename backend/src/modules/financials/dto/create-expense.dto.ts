import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategoryCode, PaymentChannel } from '@prisma/client';

export class CreateExpenseDto {
  @ApiPropertyOptional({
    enum: ExpenseCategoryCode,
    example: ExpenseCategoryCode.SITE_DEVELOPMENT_SURVEY,
    description:
      'Category: STAFF_SALARY_ALLOWANCE, MARKETING_ADVERTISING, TRANSPORTATION_FUEL, OFFICE_RENT_UTILITIES, LEGAL_DOCUMENTATION, SITE_DEVELOPMENT_SURVEY, ADMINISTRATIVE_EXPENSE, OTHER_OPERATIONAL',
  })
  @IsOptional()
  categoryCode?: ExpenseCategoryCode;

  @ApiPropertyOptional({ example: 'SITE_DEVELOPMENT_SURVEY' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Grader Hiring' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Bulldozer grading and road opening at Prampram Phase 2' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 4500.0, description: 'Expense amount in GHS' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: PaymentChannel,
    example: PaymentChannel.CASH,
    description: 'Selected means of external payment: CASH, BANK_TRANSFER, CHEQUE, MOBILE_MONEY_MTN, etc.',
  })
  @IsString()
  paymentChannel: PaymentChannel;

  @ApiPropertyOptional({ example: 'Agyei Earthmoving & Engineering Ltd.' })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({ example: 'Agyei Earthmoving & Engineering Ltd.' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiPropertyOptional({ example: 'Invoice #2026-991' })
  @IsOptional()
  @IsString()
  externalReference?: string;

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

