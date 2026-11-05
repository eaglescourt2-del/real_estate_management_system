import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CustomerQueryDto {
  @ApiPropertyOptional({ example: 'Mensah', description: 'Search by name, phone, or customer number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ description: 'Filter by assigned Sales Agent ID' })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;

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

