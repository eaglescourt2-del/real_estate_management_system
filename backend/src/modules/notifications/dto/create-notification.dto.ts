import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationTriggerEvent } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Delivery channel (WHATSAPP or EMAIL)' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationTriggerEvent, description: 'Triggering business event' })
  @IsEnum(NotificationTriggerEvent)
  event: NotificationTriggerEvent;

  @ApiProperty({
    description: 'Unique key ensuring idempotent delivery (e.g. TXN-2026-001-RCPT-WA)',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Explicit recipient phone/email (defaults to customer record)' })
  @IsString()
  @IsOptional()
  recipientDestination?: string;

  @ApiPropertyOptional({ description: 'Key-value map of variables to inject into template' })
  @IsObject()
  @IsOptional()
  templateVariables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom message body override if not using default template' })
  @IsString()
  @IsOptional()
  customMessage?: string;
}

