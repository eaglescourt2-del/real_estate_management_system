import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface LandownerVoucherPdfData {
  voucherNumber: string;
  agreementNumber: string;
  landownerName: string;
  landownerPhone: string;
  landLocationName: string;
  paymentDate: Date;
  amount: number;
  outstandingBalanceAfter: number;
  totalAgreedAmount: number;
  totalPaidAmount: number;
  paymentChannel: string;
  bankTransactionRef?: string;
  chequeNumber?: string;
  remarks?: string;
  companyName: string;
  companyTagline?: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currencySymbol: string;
  authorizingOfficerName: string;
}

export interface RefundStatementPdfData {
  refundNumber: string;
  customerName: string;
  customerNumber: string;
  customerPhone: string;
  plotNumber: string;
  landLocationName: string;
  requestDate: Date;
  totalPaymentsReceived: number;
  totalDeductions: number;
  netRefundAmount: number;
  totalRefundPaid: number;
  remainingRefundDue: number;
  reason: string;
  deductions: Array<{ deductionName: string; amount: number; explanation: string }>;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currencySymbol: string;
  approvedByName?: string;
}

@Injectable()
export class VoucherPdfService {
  private readonly logger = new Logger(VoucherPdfService.name);
  private readonly pdfOutputDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor() {
    if (!fs.existsSync(this.pdfOutputDir)) {
      fs.mkdirSync(this.pdfOutputDir, { recursive: true });
    }
  }

  async generateLandownerVoucherPdf(data: LandownerVoucherPdfData): Promise<{ pdfUrl: string; filePath: string }> {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `Voucher_${data.voucherNumber}.pdf`;
        const filePath = path.join(this.pdfOutputDir, fileName);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header Section
        doc.rect(40, 40, 515, 75).fill('#0f172a');
        const logoPath = path.join(process.cwd(), 'uploads', 'logo.png');
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, 485, 47.5, { fit: [60, 60] });
          } catch (e) {}
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

        // Voucher Title Banner
        doc.rect(40, 125, 515, 30).fill('#1e3a8a'); // Corporate Navy
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
          .text('LANDOWNER DISBURSEMENT VOUCHER', 55, 134);
        doc.fontSize(11).font('Helvetica-Bold')
          .text(data.voucherNumber, 400, 134, { width: 140, align: 'right' });

        // Metadata Box
        doc.rect(40, 165, 515, 45).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
          .text('AGREEMENT REF:', 50, 175)
          .font('Helvetica').text(data.agreementNumber, 160, 175)
          .font('Helvetica-Bold').text('PAYMENT DATE:', 340, 175)
          .font('Helvetica').text(new Date(data.paymentDate).toLocaleDateString('en-GB'), 440, 175);

        doc.font('Helvetica-Bold').text('MEANS OF PAYMENT:', 50, 192)
          .font('Helvetica').text(data.paymentChannel.replace(/_/g, ' '), 160, 192)
          .font('Helvetica-Bold').text('AUTHORIZED BY:', 340, 192)
          .font('Helvetica').text(data.authorizingOfficerName, 440, 192);

        // Beneficiary & Land Acquisition Details
        let y = 225;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('BENEFICIARY & ACQUISITION DETAILS', 40, y);

        y += 18;
        doc.rect(40, y, 515, 60).fill('#f1f5f9').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(9)
          .font('Helvetica-Bold').text('LANDOWNER / FAMILY:', 50, y + 10)
          .font('Helvetica').text(data.landownerName, 180, y + 10)
          .font('Helvetica-Bold').text('TELEPHONE:', 350, y + 10)
          .font('Helvetica').text(data.landownerPhone, 440, y + 10);

        doc.font('Helvetica-Bold').text('LAND LOCATION:', 50, y + 26)
          .font('Helvetica').text(data.landLocationName, 180, y + 26)
          .font('Helvetica-Bold').text('TOTAL ACQUISITION:', 350, y + 26)
          .font('Helvetica').text(`${data.currencySymbol} ${data.totalAgreedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 440, y + 26);

        doc.font('Helvetica-Bold').text('REFERENCE / CHEQUE:', 50, y + 42)
          .font('Helvetica').text(data.bankTransactionRef || data.chequeNumber || 'Direct Payment Recorded', 180, y + 42)
          .font('Helvetica-Bold').text('TOTAL PAID TO DATE:', 350, y + 42)
          .font('Helvetica').text(`${data.currencySymbol} ${data.totalPaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 440, y + 42);

        // Financial Breakdown Table
        y += 75;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('DISBURSEMENT ACCOUNTING', 40, y);

        y += 18;
        doc.rect(40, y, 515, 22).fill('#334155');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
          .text('DISBURSEMENT DESCRIPTION / PURPOSE', 50, y + 6)
          .text('DISBURSED AMOUNT', 415, y + 6, { width: 130, align: 'right' });

        y += 22;
        doc.rect(40, y, 515, 30).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica')
          .text(data.remarks || 'Land Acquisition Tranche Payment', 50, y + 9)
          .font('Helvetica-Bold')
          .text(`${data.currencySymbol} ${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, y + 9, { width: 130, align: 'right' });

        // Balances Summary Box
        y += 40;
        doc.rect(280, y, 275, 55).fill('#f8fafc').stroke('#1e3a8a');
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
          .text('THIS VOUCHER AMOUNT:', 290, y + 10)
          .text(`${data.currencySymbol} ${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 420, y + 10, { width: 125, align: 'right' });

        doc.fillColor('#b91c1c').fontSize(10).font('Helvetica-Bold')
          .text('REMAINING BALANCE DUE:', 290, y + 32)
          .text(`${data.currencySymbol} ${data.outstandingBalanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 420, y + 32, { width: 125, align: 'right' });

        // Signatures Section
        y += 85;
        doc.rect(40, y, 240, 50).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
          .text('PREPARED BY (ACCOUNTS OFFICER):', 50, y + 8)
          .font('Helvetica').text(data.authorizingOfficerName, 50, y + 30);

        doc.rect(315, y, 240, 50).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
          .text('RECEIVED BY (LANDOWNER / BENEFICIARY):', 325, y + 8)
          .font('Helvetica').text(data.landownerName, 325, y + 30);

        // Footer
        doc.fontSize(8).fillColor('#64748b').font('Helvetica')
          .text('Internal business payment voucher. Generated by Real Estate Management System.', 40, 715, { width: 515, align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({
            pdfUrl: `/uploads/documents/${fileName}`,
            filePath,
          });
        });

        stream.on('error', (err) => {
          this.logger.error(`Error generating voucher PDF: ${err.message}`);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateRefundStatementPdf(data: RefundStatementPdfData): Promise<{ pdfUrl: string; filePath: string }> {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `Refund_Statement_${data.refundNumber}.pdf`;
        const filePath = path.join(this.pdfOutputDir, fileName);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header Section
        doc.rect(40, 40, 515, 75).fill('#0f172a');
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, 485, 47.5, { fit: [60, 60] });
          } catch (e) {}
        }
        doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
          .text(data.companyName.toUpperCase(), 55, 52, { width: 420 });
        doc.fontSize(8.5).font('Helvetica')
          .text('Official Customer Refund Statement & Settlement Calculation', 55, 73, { width: 420 });
        doc.fontSize(8)
          .text(`Tel: ${data.companyPhone}  |  Email: ${data.companyEmail}`, 55, 87, { width: 420 });
        if (data.companyAddress) {
          doc.fontSize(7.5).fillColor('#94a3b8')
            .text(`Address: ${data.companyAddress}`, 55, 99, { width: 420 });
        }

        // Refund Title Banner
        doc.rect(40, 125, 515, 30).fill('#b91c1c'); // Crimson
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
          .text('OFFICIAL REFUND STATEMENT', 55, 134);
        doc.fontSize(11).font('Helvetica-Bold')
          .text(data.refundNumber, 400, 134, { width: 140, align: 'right' });

        // Metadata Box
        doc.rect(40, 165, 515, 45).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
          .text('CUSTOMER NAME:', 50, 175)
          .font('Helvetica').text(data.customerName, 150, 175)
          .font('Helvetica-Bold').text('CUSTOMER NO:', 350, 175)
          .font('Helvetica').text(data.customerNumber, 440, 175);

        doc.font('Helvetica-Bold').text('PROPERTY:', 50, 192)
          .font('Helvetica').text(`${data.plotNumber} (${data.landLocationName})`, 150, 192)
          .font('Helvetica-Bold').text('REQUEST DATE:', 350, 192)
          .font('Helvetica').text(new Date(data.requestDate).toLocaleDateString('en-GB'), 440, 192);

        // Refund Settlement Calculation (Formula Breakdown)
        let y = 225;
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
          .text('REFUND SETTLEMENT CALCULATION (Net Refund = Total Paid - Deductions)', 40, y);

        y += 18;
        doc.rect(40, y, 515, 22).fill('#334155');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
          .text('ITEM DESCRIPTION / EXPLANATION', 50, y + 6)
          .text('AMOUNT (GHS)', 430, y + 6, { width: 115, align: 'right' });

        // 1. Gross payments received
        y += 22;
        doc.rect(40, y, 515, 24).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
          .text('TOTAL PAYMENTS RECEIVED TO DATE', 50, y + 7)
          .text(`${data.currencySymbol} ${data.totalPaymentsReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 430, y + 7, { width: 115, align: 'right' });

        // Itemized deductions
        if (data.deductions && data.deductions.length > 0) {
          for (const d of data.deductions) {
            y += 24;
            doc.rect(40, y, 515, 28).fill('#fef2f2').stroke('#fca5a5');
            doc.fillColor('#991b1b').fontSize(8.5).font('Helvetica-Bold')
              .text(`LESS: ${d.deductionName.toUpperCase()}`, 50, y + 4)
              .font('Helvetica')
              .text(d.explanation, 50, y + 15, { width: 360 })
              .font('Helvetica-Bold')
              .text(`- ${data.currencySymbol} ${d.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 430, y + 8, { width: 115, align: 'right' });
          }
        }

        // Net Refund Approved
        y += 32;
        doc.rect(40, y, 515, 26).fill('#ecfdf5').stroke('#059669');
        doc.fillColor('#065f46').fontSize(10).font('Helvetica-Bold')
          .text('NET APPROVED REFUND PAYABLE', 50, y + 8)
          .text(`${data.currencySymbol} ${data.netRefundAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 430, y + 8, { width: 115, align: 'right' });

        // Disbursement Summary
        y += 36;
        doc.rect(280, y, 275, 55).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
          .text('TOTAL REFUND DISBURSED TO DATE:', 290, y + 10)
          .font('Helvetica').text(`${data.currencySymbol} ${data.totalRefundPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 430, y + 10, { width: 115, align: 'right' });

        doc.fillColor('#b91c1c').fontSize(9).font('Helvetica-Bold')
          .text('OUTSTANDING REFUND DUE:', 290, y + 32)
          .font('Helvetica-Bold').text(`${data.currencySymbol} ${data.remainingRefundDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 430, y + 32, { width: 115, align: 'right' });

        // Signatures
        y += 85;
        doc.rect(40, y, 240, 50).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
          .text('APPROVED BY MANAGING DIRECTOR:', 50, y + 8)
          .font('Helvetica').text(data.approvedByName || 'Authorized Executive Director', 50, y + 30);

        doc.rect(315, y, 240, 50).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
          .text('CUSTOMER ACCEPTANCE:', 325, y + 8)
          .font('Helvetica').text(data.customerName, 325, y + 30);

        // Footer
        doc.fontSize(8).fillColor('#64748b').font('Helvetica')
          .text('Official Refund Settlement Statement. Subject to signed release of property beacons.', 40, 715, { width: 515, align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({
            pdfUrl: `/uploads/documents/${fileName}`,
            filePath,
          });
        });

        stream.on('error', (err) => {
          this.logger.error(`Error generating refund PDF: ${err.message}`);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

