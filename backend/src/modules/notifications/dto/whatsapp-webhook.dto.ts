import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WhatsAppWebhookVerifyDto {
  @IsString()
  @IsNotEmpty()
  'hub.mode': string;

  @IsString()
  @IsNotEmpty()
  'hub.verify_token': string;

  @IsString()
  @IsNotEmpty()
  'hub.challenge': string;
}

export class UpdateNotificationTemplateDto {
  @IsString()
  @IsNotEmpty()
  bodyTemplate: string;

  @IsOptional()
  isActive?: boolean;
}
