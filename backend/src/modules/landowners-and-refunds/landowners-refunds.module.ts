import { Module } from '@nestjs/common';
import { LandownersService } from './landowners.service';
import { LandownersController } from './landowners.controller';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { VoucherPdfService } from './voucher-pdf.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [LandownersController, RefundsController],
  providers: [LandownersService, RefundsService, VoucherPdfService],
  exports: [LandownersService, RefundsService, VoucherPdfService],
})
export class LandownersRefundsModule {}
