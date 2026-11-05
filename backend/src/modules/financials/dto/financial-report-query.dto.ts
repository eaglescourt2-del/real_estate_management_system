import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategoryCode, PaymentChannel } from '@prisma/client';

export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  CUSTOM = 'CUSTOM',
}

export class FinancialReportQueryDto {
  @ApiPropertyOptional({ enum: ReportPeriod, example: ReportPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod = ReportPeriod.MONTHLY;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00Z', description: 'Start date filter' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59Z', description: 'End date filter' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by Land Location UUID' })
  @IsOptional()
  @IsString()
  landLocationId?: string;

  @ApiPropertyOptional({ enum: ExpenseCategoryCode })
  @IsOptional()
  @IsEnum(ExpenseCategoryCode)
  expenseCategory?: ExpenseCategoryCode;

  @ApiPropertyOptional({ enum: PaymentChannel })
  @IsOptional()
  @IsEnum(PaymentChannel)
  paymentChannel?: PaymentChannel;
}
