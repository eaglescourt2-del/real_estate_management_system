import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

export interface FinancialExcelData {
  companyName: string;
  reportTitle: string;
  periodDescription: string;
  currencySymbol: string;
  incomeRecords: Array<{
    transactionRef: string;
    transactionDate: Date;
    sourceCategory: string;
    description: string;
    paymentChannel: string;
    amount: number;
  }>;
  expenseRecords: Array<{
    expenseReference: string;
    expenseDate: Date;
    categoryCode: string;
    recipient: string;
    description: string;
    paymentChannel: string;
    amount: number;
    approvalStatus: string;
  }>;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    totalOperationalExpenses: number;
    netOperationalProfit: number;
    totalLandownerDisbursements: number;
    totalRefundDisbursements: number;
    netOverallCashFlow: number;
  };
}

@Injectable()
export class FinancialExcelService {
  private readonly logger = new Logger(FinancialExcelService.name);
  private readonly excelOutputDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor() {
    if (!fs.existsSync(this.excelOutputDir)) {
      fs.mkdirSync(this.excelOutputDir, { recursive: true });
    }
  }

  async generateFinancialWorkbook(data: FinancialExcelData): Promise<{ fileUrl: string; filePath: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = data.companyName;
    workbook.created = new Date();

    // -------------------------------------------------------------
    // SHEET 1: EXECUTIVE PROFIT & LOSS SUMMARY
    // -------------------------------------------------------------
    const summarySheet = workbook.addWorksheet('P&L Executive Summary', {
      views: [{ showGridLines: true }],
    });

    summarySheet.columns = [
      { width: 35 },
      { width: 25 },
      { width: 20 },
    ];

    // Corporate Header
    summarySheet.mergeCells('A1:C1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = data.companyName.toUpperCase();
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;

    summarySheet.mergeCells('A2:C2');
    const subCell = summarySheet.getCell('A2');
    subCell.value = `${data.reportTitle} - (${data.periodDescription})`;
    subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Emerald
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).height = 22;

    summarySheet.addRow([]); // Blank row

    // Section 1: Revenue & Cash Receipts
    summarySheet.addRow(['REVENUE & CASH RECEIPTS', 'AMOUNT (GHS)', '% OF REVENUE']);
    const revHeaderRow = summarySheet.lastRow;
    revHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    revHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

    // Group income by category
    const incomeByCategory: Record<string, number> = {};
    for (const inc of data.incomeRecords) {
      incomeByCategory[inc.sourceCategory] = (incomeByCategory[inc.sourceCategory] || 0) + Number(inc.amount);
    }

    for (const [cat, amt] of Object.entries(incomeByCategory)) {
      const pct = data.summary.totalRevenue > 0 ? (amt / data.summary.totalRevenue) * 100 : 0;
      const row = summarySheet.addRow([cat.replace(/_/g, ' '), amt, `${pct.toFixed(1)}%`]);
      row.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    }

    const totalRevRow = summarySheet.addRow(['TOTAL CASH REVENUE', data.summary.totalRevenue, '100.0%']);
    totalRevRow.font = { bold: true };
    totalRevRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    totalRevRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };

    summarySheet.addRow([]);

    // Section 2: Core Operational Expenses (Excl. Landowner & Refunds)
    summarySheet.addRow(['CORE OPERATIONAL EXPENDITURE (EXCL. LANDOWNER)', 'AMOUNT (GHS)', '% OF REVENUE']);
    const opExpHeaderRow = summarySheet.lastRow;
    opExpHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    opExpHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

    const opExpensesByCategory: Record<string, number> = {};
    for (const exp of data.expenseRecords) {
      const isLandowner =
        exp.categoryCode === 'LANDOWNER_PAYMENT' ||
        exp.categoryCode === 'LAND_ACQUISITION';
      const isRefund = exp.categoryCode === 'CUSTOMER_REFUND_DISBURSEMENT';

      if (!isLandowner && !isRefund) {
        opExpensesByCategory[exp.categoryCode] = (opExpensesByCategory[exp.categoryCode] || 0) + Number(exp.amount);
      }
    }

    for (const [cat, amt] of Object.entries(opExpensesByCategory)) {
      const pct = data.summary.totalRevenue > 0 ? (amt / data.summary.totalRevenue) * 100 : 0;
      const row = summarySheet.addRow([cat.replace(/_/g, ' '), amt, `${pct.toFixed(1)}%`]);
      row.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    }

    const totalOpExpRow = summarySheet.addRow(['TOTAL OPERATIONAL EXPENSES (EXCL. LANDOWNER)', data.summary.totalOperationalExpenses, '']);
    totalOpExpRow.font = { bold: true };
    totalOpExpRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    totalOpExpRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

    summarySheet.addRow([]);

    // Section 3: Net Operational Profit (Core Operations)
    const netOpRow = summarySheet.addRow([
      'NET OPERATIONAL PROFIT (EXCL. LANDOWNER)',
      data.summary.netOperationalProfit,
      data.summary.totalRevenue > 0
        ? `${((data.summary.netOperationalProfit / data.summary.totalRevenue) * 100).toFixed(1)}%`
        : '0.0%',
    ]);
    netOpRow.font = { bold: true, size: 11 };
    netOpRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    netOpRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: data.summary.netOperationalProfit >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' },
    };

    summarySheet.addRow([]);

    // Section 4: Capital Land Acquisitions & Refunds
    summarySheet.addRow(['LANDOWNER DISBURSEMENTS & CAPITAL OUTFLOWS', 'AMOUNT (GHS)', 'TYPE']);
    const capHeaderRow = summarySheet.lastRow;
    capHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    capHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    const loRow = summarySheet.addRow(['Total Disbursements to Landowners', data.summary.totalLandownerDisbursements, 'Capital Land Acquisition']);
    loRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    loRow.font = { bold: true };

    const refRow = summarySheet.addRow(['Total Customer Refunds Disbursed', data.summary.totalRefundDisbursements, 'Approved Plot Cancellations']);
    refRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    refRow.font = { bold: true };

    const totalOutflowRow = summarySheet.addRow(['TOTAL COMBINED CASH OUTFLOW', data.summary.totalExpenses, 'All Outflows']);
    totalOutflowRow.font = { bold: true };
    totalOutflowRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    totalOutflowRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    summarySheet.addRow([]);

    // Section 5: Net Cash Flow / Overall Surplus (Deficit)
    const netCashRow = summarySheet.addRow([
      'NET CASH POSITION / OVERALL SURPLUS (DEFICIT)',
      data.summary.netOverallCashFlow,
      data.summary.totalRevenue > 0
        ? `${((data.summary.netOverallCashFlow / data.summary.totalRevenue) * 100).toFixed(1)}%`
        : '0.0%',
    ]);
    netCashRow.font = { bold: true, size: 12 };
    netCashRow.getCell(2).numFmt = `"${data.currencySymbol}" #,##0.00`;
    netCashRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: data.summary.netOverallCashFlow >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' },
    };

    // -------------------------------------------------------------
    // SHEET 2: ITEMIZED CASH REVENUE
    // -------------------------------------------------------------
    const incSheet = workbook.addWorksheet('Itemized Revenue Transactions', {
      views: [{ showGridLines: true }],
    });

    incSheet.columns = [
      { header: 'TXN REF', key: 'ref', width: 22 },
      { header: 'DATE', key: 'date', width: 14 },
      { header: 'CATEGORY', key: 'cat', width: 28 },
      { header: 'DESCRIPTION', key: 'desc', width: 45 },
      { header: 'MEANS OF PAYMENT', key: 'chan', width: 24 },
      { header: 'AMOUNT (GHS)', key: 'amt', width: 18 },
    ];

    incSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    incSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    for (const inc of data.incomeRecords) {
      const row = incSheet.addRow({
        ref: inc.transactionRef,
        date: new Date(inc.transactionDate).toLocaleDateString('en-GB'),
        cat: inc.sourceCategory.replace(/_/g, ' '),
        desc: inc.description,
        chan: inc.paymentChannel.replace(/_/g, ' '),
        amt: Number(inc.amount),
      });
      row.getCell('amt').numFmt = `#,##0.00`;
    }

    // -------------------------------------------------------------
    // SHEET 3: ITEMIZED OPERATING EXPENSES
    // -------------------------------------------------------------
    const expSheet = workbook.addWorksheet('Itemized Expense Ledger', {
      views: [{ showGridLines: true }],
    });

    expSheet.columns = [
      { header: 'EXP REF', key: 'ref', width: 22 },
      { header: 'DATE', key: 'date', width: 14 },
      { header: 'CATEGORY', key: 'cat', width: 30 },
      { header: 'BENEFICIARY / RECIPIENT', key: 'recip', width: 30 },
      { header: 'DESCRIPTION', key: 'desc', width: 40 },
      { header: 'MEANS OF PAYMENT', key: 'chan', width: 22 },
      { header: 'AMOUNT (GHS)', key: 'amt', width: 18 },
      { header: 'APPROVAL STATUS', key: 'status', width: 20 },
    ];

    expSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    expSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    for (const exp of data.expenseRecords) {
      const row = expSheet.addRow({
        ref: exp.expenseReference,
        date: new Date(exp.expenseDate).toLocaleDateString('en-GB'),
        cat: exp.categoryCode.replace(/_/g, ' '),
        recip: exp.recipient,
        desc: exp.description,
        chan: exp.paymentChannel.replace(/_/g, ' '),
        amt: Number(exp.amount),
        status: exp.approvalStatus,
      });
      row.getCell('amt').numFmt = `#,##0.00`;
    }

    // Save to disk
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Financial_Report_${timestamp}_${Date.now()}.xlsx`;
    const filePath = path.join(this.excelOutputDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return {
      fileUrl: `/uploads/documents/${fileName}`,
      filePath,
    };
  }
}

