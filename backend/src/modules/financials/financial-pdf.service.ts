import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface FinancialPdfData {
  companyName: string;
  companyTagline?: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currencySymbol: string;
  reportTitle: string;
  periodDescription: string;
  revenueSummary: Record<string, number>;
  expenseSummary: Record<string, number>;
  totalRevenue: number;
  totalExpenses: number;
  netOperatingIncome: number;
  totalReceivablesOutstanding: number;
  generatedByName: string;
}

@Injectable()
export class FinancialPdfService {
  private readonly logger = new Logger(FinancialPdfService.name);
  private readonly pdfOutputDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor() {
    if (!fs.existsSync(this.pdfOutputDir)) {
      fs.mkdirSync(this.pdfOutputDir, { recursive: true });
    }
  }

  async generateFinancialStatementPdf(data: FinancialPdfData): Promise<{ pdfUrl: string; filePath: string }> {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = `Financial_Statement_${timestamp}_${Date.now()}.pdf`;
        const filePath = path.join(this.pdfOutputDir, fileName);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.rect(40, 40, 515, 75).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
          .text(data.companyName.toUpperCase(), 55, 55);
        doc.fontSize(9).font('Helvetica')
          .text(data.companyTagline || 'Ghanaian Real Estate & Land Management System', 55, 78);
        doc.fontSize(8)
          .text(`Tel: ${data.companyPhone}  |  Email: ${data.companyEmail}`, 55, 93);

        // Report Title Banner
        doc.rect(40, 125, 515, 30).fill('#047857');
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
          .text(data.reportTitle.toUpperCase(), 55, 134);
        doc.fontSize(10).font('Helvetica')
          .text(data.periodDescription, 360, 134, { width: 180, align: 'right' });

        // Financial Overview Snapshot Cards
        let y = 170;
        doc.rect(40, y, 160, 50).fill('#ecfdf5').stroke('#a7f3d0');
        doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold').text('TOTAL CASH REVENUE', 50, y + 10);
        doc.fontSize(12).text(`${data.currencySymbol} ${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 50, y + 25);

        doc.rect(215, y, 160, 50).fill('#fef2f2').stroke('#fca5a5');
        doc.fillColor('#991b1b').fontSize(8.5).font('Helvetica-Bold').text('TOTAL OPERATING EXPENSES', 225, y + 10);
        doc.fontSize(12).text(`${data.currencySymbol} ${data.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 225, y + 25);

        doc.rect(390, y, 165, 50).fill(data.netOperatingIncome >= 0 ? '#f0fdf4' : '#fff1f2').stroke(data.netOperatingIncome >= 0 ? '#86efac' : '#fecdd3');
        doc.fillColor(data.netOperatingIncome >= 0 ? '#166534' : '#9f1239').fontSize(8.5).font('Helvetica-Bold').text('NET CASH SURPLUS / DEFICIT', 400, y + 10);
        doc.fontSize(12).text(`${data.currencySymbol} ${data.netOperatingIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, y + 25);

        // Section 1: Cash Receipts by Category
        y = 235;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('1. CASH RECEIPTS & LAND SALES REVENUE', 40, y);

        y += 18;
        doc.rect(40, y, 515, 20).fill('#334155');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
          .text('SOURCE CATEGORY', 50, y + 5)
          .text('AMOUNT (GHS)', 415, y + 5, { width: 130, align: 'right' });

        for (const [cat, amt] of Object.entries(data.revenueSummary)) {
          y += 20;
          doc.rect(40, y, 515, 20).fill('#ffffff').stroke('#cbd5e1');
          doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
            .text(cat.replace(/_/g, ' '), 50, y + 5)
            .text(`${data.currencySymbol} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, y + 5, { width: 130, align: 'right' });
        }

        // Section 2: Operating Expenditure by Category
        y += 35;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('2. OPERATING EXPENDITURES & OBLIGATIONS', 40, y);

        y += 18;
        doc.rect(40, y, 515, 20).fill('#334155');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
          .text('EXPENSE CATEGORY', 50, y + 5)
          .text('AMOUNT (GHS)', 415, y + 5, { width: 130, align: 'right' });

        for (const [cat, amt] of Object.entries(data.expenseSummary)) {
          y += 20;
          doc.rect(40, y, 515, 20).fill('#ffffff').stroke('#cbd5e1');
          doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
            .text(cat.replace(/_/g, ' '), 50, y + 5)
            .text(`${data.currencySymbol} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, y + 5, { width: 130, align: 'right' });
        }

        // Balance Sheet Note (Receivables)
        y += 35;
        doc.rect(40, y, 515, 35).fill('#f8fafc').stroke('#64748b');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
          .text('ACCOUNTS RECEIVABLE (OUTSTANDING CUSTOMER INSTALMENT BALANCES):', 50, y + 11)
          .text(`${data.currencySymbol} ${data.totalReceivablesOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, y + 11, { width: 130, align: 'right' });

        // Footer / Verification
        doc.fontSize(8).fillColor('#64748b').font('Helvetica')
          .text(`Generated by: ${data.generatedByName} on ${new Date().toUTCString()}`, 40, 715, { width: 515, align: 'center' })
          .text('Confidential Internal Financial Statement. Generated by Real Estate Management System.', 40, 728, { width: 515, align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({
            pdfUrl: `/uploads/documents/${fileName}`,
            filePath,
          });
        });

        stream.on('error', (err) => {
          this.logger.error(`Error generating financial PDF statement: ${err.message}`);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

