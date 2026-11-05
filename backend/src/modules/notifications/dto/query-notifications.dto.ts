import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus, NotificationTriggerEvent } from '@prisma/client';

export class QueryNotificationsDto {
  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ enum: NotificationChannel, description: 'Filter by channel' })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationTriggerEvent, description: 'Filter by event' })
  @IsEnum(NotificationTriggerEvent)
  @IsOptional()
  event?: NotificationTriggerEvent;

  @ApiPropertyOptional({ enum: NotificationStatus, description: 'Filter by status' })
  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;

  @ApiPropertyOptional({ description: 'Filter logs created from date (ISO 8601)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter logs created up to date (ISO 8601)' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

