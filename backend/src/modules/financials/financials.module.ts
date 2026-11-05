import { Module } from '@nestjs/common';
import { FinancialsService } from './financials.service';
import { FinancialsController } from './financials.controller';
import { FinancialExcelService } from './financial-excel.service';
import { FinancialPdfService } from './financial-pdf.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [FinancialsController],
  providers: [FinancialsService, FinancialExcelService, FinancialPdfService],
  exports: [FinancialsService, FinancialExcelService, FinancialPdfService],
})
export class FinancialsModule {}

