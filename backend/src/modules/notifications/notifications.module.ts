import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './channels/whatsapp.service';
import { EmailService } from './channels/email.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppService, EmailService],
  exports: [NotificationsService, WhatsAppService, EmailService],
})
export class NotificationsModule {}
