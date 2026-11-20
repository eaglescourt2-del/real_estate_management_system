import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';

export interface ReceiptPdfData {
  receiptNumber: string;
  transactionReference: string;
  paymentDate: Date;
  amountReceived: number;
  outstandingBalanceAfter: number;
  paymentCategory: string;
  paymentChannel: string;
  externalRef?: string;
  bankDetails?: string;
  companyName: string;
  companyTagline?: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currencySymbol: string;
  customerName: string;
  customerNumber: string;
  customerPhone: string;
  landLocationName: string;
  plotNumber: string;
  plotDimensions: string;
  agreedPrice: number;
  recordingStaffName: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly pdfOutputDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor() {
    if (!fs.existsSync(this.pdfOutputDir)) {
      fs.mkdirSync(this.pdfOutputDir, { recursive: true });
    }
  }

  async generateReceiptPdf(data: ReceiptPdfData): Promise<{ pdfUrl: string; filePath: string }> {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `Receipt_${data.receiptNumber}.pdf`;
        const filePath = path.join(this.pdfOutputDir, fileName);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header Section with Corporate Colors (Dark Slate & Emerald)
        doc.rect(40, 40, 515, 75).fill('#0f172a');

        const logoPath = path.join(process.cwd(), 'uploads', 'logo.png');
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, 485, 47.5, { fit: [60, 60] });
          } catch (e) {
            // fallback if image read fails
          }
        }

        doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
          .text(data.companyName.toUpperCase(), 55, 52, { width: 420 });

        doc.fontSize(8.5).font('Helvetica')
          .text(data.companyTagline || 'Your Trusted Partner in Land Sales', 55, 73, { width: 420 });

        doc.fontSize(8)
          .text(`Tel: ${data.companyPhone}  |  Email: ${data.companyEmail}`, 55, 87, { width: 420 });

        if (data.companyAddress) {
          doc.fontSize(7.5).fillColor('#94a3b8')
            .text(`Address: ${data.companyAddress}`, 55, 99, { width: 420 });
        }

        // Receipt Title Banner
        doc.rect(40, 125, 515, 30).fill('#047857'); // Emerald green
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
          .text('OFFICIAL TRANSACTION RECEIPT', 55, 134);

        doc.fontSize(11).font('Helvetica-Bold')
          .text(data.receiptNumber, 420, 134, { width: 120, align: 'right' });

        // Metadata Grid (Date, Txn Ref, Staff)
        doc.rect(40, 165, 515, 45).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
          .text('TRANSACTION REF:', 50, 175)
          .font('Helvetica').text(data.transactionReference, 160, 175)
          .font('Helvetica-Bold').text('DATE RECEIVED:', 340, 175)
          .font('Helvetica').text(new Date(data.paymentDate).toLocaleDateString('en-GB'), 430, 175);

        doc.font('Helvetica-Bold').text('ISSUED BY:', 50, 192)
          .font('Helvetica').text(data.recordingStaffName, 160, 192)
          .font('Helvetica-Bold').text('PAYMENT CHANNEL:', 340, 192)
          .font('Helvetica').text(data.paymentChannel.replace(/_/g, ' '), 430, 192);

        // Customer & Land Property Table
        let y = 225;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('CUSTOMER & PROPERTY DETAILS', 40, y);

        y += 18;
        doc.rect(40, y, 515, 60).fill('#f1f5f9').stroke('#cbd5e1');

        doc.fillColor('#334155').fontSize(9)
          .font('Helvetica-Bold').text('CUSTOMER NAME:', 50, y + 10)
          .font('Helvetica').text(data.customerName, 160, y + 10)
          .font('Helvetica-Bold').text('CUSTOMER NO:', 350, y + 10)
          .font('Helvetica').text(data.customerNumber, 440, y + 10);

        doc.font('Helvetica-Bold').text('TELEPHONE:', 50, y + 26)
          .font('Helvetica').text(data.customerPhone, 160, y + 26)
          .font('Helvetica-Bold').text('LAND LOCATION:', 350, y + 26)
          .font('Helvetica').text(data.landLocationName, 440, y + 26);

        doc.font('Helvetica-Bold').text('ASSIGNED PLOT:', 50, y + 42)
          .font('Helvetica').text(`${data.plotNumber} (${data.plotDimensions})`, 160, y + 42)
          .font('Helvetica-Bold').text('AGREED PRICE:', 350, y + 42)
          .font('Helvetica').text(`${data.currencySymbol} ${data.agreedPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 440, y + 42);

        // Financial Payment Statement Table
        y += 75;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('PAYMENT BREAKDOWN', 40, y);

        y += 18;
        // Table Header
        doc.rect(40, y, 515, 22).fill('#334155');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
          .text('DESCRIPTION / CATEGORY', 50, y + 6)
          .text('EXTERNAL REFERENCE', 240, y + 6)
          .text('AMOUNT RECEIVED', 415, y + 6, { width: 130, align: 'right' });

        // Table Row
        y += 22;
        doc.rect(40, y, 515, 30).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica')
          .text(data.paymentCategory.replace(/_/g, ' '), 50, y + 9)
          .text(data.externalRef || data.bankDetails || 'Direct Reconciled', 240, y + 9)
          .font('Helvetica-Bold')
          .text(`${data.currencySymbol} ${data.amountReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, y + 9, { width: 130, align: 'right' });

        // Totals Box
        y += 40;
        doc.rect(280, y, 275, 55).fill('#f8fafc').stroke('#047857');
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
          .text('TOTAL RECEIVED NOW:', 290, y + 10)
          .text(`${data.currencySymbol} ${data.amountReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 420, y + 10, { width: 125, align: 'right' });

        doc.fillColor('#b91c1c').fontSize(10).font('Helvetica-Bold')
          .text('OUTSTANDING BALANCE:', 290, y + 32)
          .text(`${data.currencySymbol} ${data.outstandingBalanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 420, y + 32, { width: 125, align: 'right' });

        // Footer / Verification Notice
        doc.fontSize(8).fillColor('#64748b').font('Helvetica')
          .text(
            'This is an official computer-generated receipt from the Real Estate Management System. Valid only with verified payment reference.',
            40,
            700,
            { width: 515, align: 'center' },
          )
          .text(
            `${data.companyAddress}  |  Generated on ${new Date().toUTCString()}`,
            40,
            715,
            { width: 515, align: 'center' },
          );

        doc.end();

        stream.on('finish', () => {
          resolve({
            pdfUrl: `/uploads/documents/${fileName}`,
            filePath,
          });
        });

        stream.on('error', (err) => {
          this.logger.error(`Error generating PDF receipt: ${err.message}`);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

