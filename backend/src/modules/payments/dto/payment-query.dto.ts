import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentCategory, PaymentChannel, PaymentVerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class PaymentQueryDto {
  @ApiPropertyOptional({ example: 'TXN-20261105' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PaymentCategory })
  @IsOptional()
  @IsEnum(PaymentCategory)
  category?: PaymentCategory;

  @ApiPropertyOptional({ enum: PaymentChannel })
  @IsOptional()
  @IsEnum(PaymentChannel)
  channel?: PaymentChannel;

  @ApiPropertyOptional({ enum: PaymentVerificationStatus })
  @IsOptional()
  @IsEnum(PaymentVerificationStatus)
  status?: PaymentVerificationStatus;

  @ApiPropertyOptional({ description: 'Filter by Customer UUID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by Plot Allocation UUID' })
  @IsOptional()
  @IsString()
  allocationId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 25;
}
