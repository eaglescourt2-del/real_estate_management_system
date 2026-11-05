import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PdfGeneratorService } from './pdf-generator.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PdfGeneratorService],
  exports: [PaymentsService, PdfGeneratorService],
})
export class PaymentsModule {}

