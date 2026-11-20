import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialExcelService } from './financial-excel.service';
import { FinancialPdfService } from './financial-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { FinancialReportQueryDto, ReportPeriod } from './dto/financial-report-query.dto';
import {
  ExpenseApprovalStatus,
  ExpenseCategoryCode,
  PaymentChannel,
  PaymentCategory,
  AuditAction,
  UserRole,
  AllocationStatus,
} from '@prisma/client';

@Injectable()
export class FinancialsService {
  private readonly logger = new Logger(FinancialsService.name);
  private readonly MAJOR_EXPENSE_THRESHOLD = 5000; // GHS 5,000 threshold for MD approval

  constructor(
    private prisma: PrismaService,
    private excelService: FinancialExcelService,
    private pdfService: FinancialPdfService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Resolves date range based on report period filter (DAILY, WEEKLY, MONTHLY, ANNUAL, CUSTOM)
   */
  private resolveDateRange(query: FinancialReportQueryDto): { start: Date; end: Date; label: string } {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    let label = 'Custom Period';

    if (query.period === ReportPeriod.DAILY) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      label = `Daily Report - ${start.toLocaleDateString('en-GB')}`;
    } else if (query.period === ReportPeriod.WEEKLY) {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      label = `Weekly Report (${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')})`;
    } else if (query.period === ReportPeriod.MONTHLY) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      label = `Monthly Report - ${start.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    } else if (query.period === ReportPeriod.ANNUAL) {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      label = `Annual Report - Year ${now.getFullYear()}`;
    } else if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
      label = `${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')}`;
    }

    return { start, end, label };
  }

  /**
   * RECORD OPERATIONAL EXPENSE:
   * Staff records business expenditure (MoMo, Bank, Cash, Cheque),
   * assigns category, recipient, and immediately marks as APPROVED (MD approval removed per policy).
   */
  async recordExpense(dto: CreateExpenseDto, staffUser: { id: string; role: UserRole }) {
    const expenseAmount = Number(dto.amount);
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    let count = (await this.prisma.expense.count({
      where: { expenseReference: { startsWith: `EXP-${dateStr}-` } },
    })) + 1;
    let expenseReference = `EXP-${dateStr}-${String(count).padStart(4, '0')}`;
    while (await this.prisma.expense.findUnique({ where: { expenseReference } })) {
      count++;
      expenseReference = `EXP-${dateStr}-${String(count).padStart(4, '0')}`;
    }

    // Resolve categoryCode with intelligent fallback
    let categoryCode: ExpenseCategoryCode = dto.categoryCode || ExpenseCategoryCode.OTHER_OPERATIONAL;
    const catStr = String(dto.categoryCode || dto.category || '').toUpperCase();
    if (catStr.includes('SITE') || catStr.includes('SURVEY') || catStr.includes('PILLAR') || catStr.includes('DEVELOPMENT')) {
      categoryCode = ExpenseCategoryCode.SITE_DEVELOPMENT_SURVEY;
    } else if (catStr.includes('LEGAL') || catStr.includes('INDENTURE') || catStr.includes('DOCUMENT')) {
      categoryCode = ExpenseCategoryCode.LEGAL_DOCUMENTATION;
    } else if (catStr.includes('MARKETING') || catStr.includes('MEDIA') || catStr.includes('ADVERT')) {
      categoryCode = ExpenseCategoryCode.MARKETING_ADVERTISING;
    } else if (catStr.includes('SALAR') || catStr.includes('STAFF') || catStr.includes('COMPENSATION')) {
      categoryCode = ExpenseCategoryCode.STAFF_SALARY_ALLOWANCE;
    } else if (catStr.includes('RENT') || catStr.includes('OFFICE') || catStr.includes('UTILIT')) {
      categoryCode = ExpenseCategoryCode.OFFICE_RENT_UTILITIES;
    } else if (catStr.includes('ADMIN')) {
      categoryCode = ExpenseCategoryCode.ADMINISTRATIVE_EXPENSE;
    } else if (catStr.includes('TRANSPORT') || catStr.includes('FUEL')) {
      categoryCode = ExpenseCategoryCode.TRANSPORTATION_FUEL;
    } else if (catStr.includes('ACQUISITION')) {
      categoryCode = ExpenseCategoryCode.LAND_ACQUISITION;
    }

    // Resolve payment channel with intelligent fallback
    let channel: PaymentChannel = dto.paymentChannel as PaymentChannel;
    const chanStr = String(dto.paymentChannel || '').toUpperCase();
    if (chanStr === 'CASH' || chanStr === 'CASH_OFFICE') {
      channel = PaymentChannel.CASH;
    } else if (chanStr === 'BANK_TRANSFER' || chanStr === 'BANK') {
      channel = PaymentChannel.BANK_TRANSFER;
    } else if (chanStr === 'CHEQUE') {
      channel = PaymentChannel.CHEQUE;
    } else if (chanStr.includes('TELECEL')) {
      channel = PaymentChannel.MOBILE_MONEY_TELECEL;
    } else if (chanStr.includes('AT')) {
      channel = PaymentChannel.MOBILE_MONEY_AT;
    } else if (chanStr.includes('MOBILE') || chanStr.includes('MOMO') || chanStr.includes('MTN')) {
      channel = PaymentChannel.MOBILE_MONEY_MTN;
    }

    // Resolve description
    const descParts = [dto.title?.trim(), dto.description?.trim()].filter(Boolean);
    const finalDescription = descParts.length > 0 ? descParts.join(' - ') : 'Operational Expenditure';

    // Resolve recipient / payee
    const finalRecipient = dto.recipient?.trim() || dto.vendorName?.trim() || 'General Payee / Vendor';

    // MD approval requirement removed: all expenses are immediately APPROVED upon recording
    const approvalStatus: ExpenseApprovalStatus = ExpenseApprovalStatus.APPROVED;

    const expense = await this.prisma.expense.create({
      data: {
        expenseReference,
        categoryCode,
        description: finalDescription,
        amount: expenseAmount,
        currency: 'GHS',
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : today,
        paymentChannel: channel,
        recipient: finalRecipient,
        landLocationId: dto.landLocationId,
        supportingReceiptUrl: dto.supportingReceiptUrl,
        recordedByUserId: staffUser.id,
        approvedByUserId: staffUser.id,
        approvalStatus,
      },
      include: {
        landLocation: { select: { id: true, name: true } },
        recordedByUser: { select: { firstName: true, lastName: true } },
      },
    });

    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId: staffUser?.id || null,
        action: AuditAction.CREATE,
        entityName: 'Expense',
        entityId: expense.id,
        newValues: {
          expenseReference,
          category: categoryCode,
          amount: expenseAmount,
          channel,
          recipient: finalRecipient,
          status: approvalStatus,
        },
      },
    });

    return {
      message: `Expense ${expenseReference} of GHS ${expenseAmount.toLocaleString()} recorded successfully.`,
      expense,
    };
  }

  /**
   * LIST ALL OPERATIONAL & DISBURSEMENT EXPENSES
   */
  async getExpenses(query?: any) {
    const where: any = {};
    if (query?.categoryCode) where.categoryCode = query.categoryCode;
    if (query?.paymentChannel) where.paymentChannel = query.paymentChannel;
    if (query?.landLocationId) where.landLocationId = query.landLocationId;

    return this.prisma.expense.findMany({
      where,
      include: {
        landLocation: { select: { id: true, name: true } },
        recordedByUser: { select: { firstName: true, lastName: true } },
        landownerPayment: { select: { voucherNumber: true } },
        refundPayment: { select: { refundDisbursementRef: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async approveExpense(id: string, dto: ApproveExpenseDto, staffUser: { id: string; role: UserRole }) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense with ID '${id}' not found.`);

    const newStatus = dto.approved ? ExpenseApprovalStatus.APPROVED : ExpenseApprovalStatus.REJECTED;

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: newStatus,
        approvedByUserId: staffUser.id,
      },
    });

    return {
      message: `Expense ${expense.expenseReference} status updated to ${newStatus}.`,
      expense: updated,
    };
  }

  /**
   * RECORD OPERATIONAL INCOME:
   * Record other non-plot cash receipts (consultation, site tour, legal survey)
   */
  async recordIncome(dto: CreateIncomeDto, staffUser: { id: string; role: UserRole }) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    let count = (await this.prisma.incomeTransaction.count({
      where: { transactionRef: { startsWith: `INC-${dateStr}-` } },
    })) + 1;
    let transactionRef = `INC-${dateStr}-${String(count).padStart(4, '0')}`;
    while (await this.prisma.incomeTransaction.findUnique({ where: { transactionRef } })) {
      count++;
      transactionRef = `INC-${dateStr}-${String(count).padStart(4, '0')}`;
    }

    const income = await this.prisma.incomeTransaction.create({
      data: {
        transactionRef,
        sourceCategory: dto.sourceCategory,
        description: dto.description.trim(),
        amount: dto.amount,
        currency: 'GHS',
        transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : today,
        paymentChannel: dto.paymentChannel,
      },
    });

    return {
      message: `Income transaction ${transactionRef} of GHS ${Number(dto.amount).toLocaleString()} recorded.`,
      income,
    };
  }

  /**
   * COMPREHENSIVE PROFIT & LOSS / CASH FLOW STATEMENT
   * Includes Customer Payments (land deposits, installment collections, outright purchases)
   * plus standalone miscellaneous operational income.
   */
  async getProfitAndLoss(query: FinancialReportQueryDto) {
    const { start, end, label } = this.resolveDateRange(query);

    // 1. Fetch Customer Payments within range (unreversed)
    const paymentWhere: any = {
      paymentDate: { gte: start, lte: end },
      isReversed: false,
    };
    if (query.paymentChannel) paymentWhere.paymentChannel = query.paymentChannel;
    if (query.landLocationId) {
      paymentWhere.allocation = {
        plot: { landLocationId: query.landLocationId },
      };
    }

    const customerPayments = await this.prisma.customerPayment.findMany({
      where: paymentWhere,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        allocation: {
          include: {
            plot: { include: { landLocation: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // 2. Fetch Standalone Miscellaneous Income records (not tied to customer payments) within range
    const incomeWhere: any = {
      transactionDate: { gte: start, lte: end },
      customerPaymentId: null,
    };
    if (query.paymentChannel) incomeWhere.paymentChannel = query.paymentChannel;

    const standaloneIncomeRecords = await this.prisma.incomeTransaction.findMany({
      where: incomeWhere,
      orderBy: { transactionDate: 'desc' },
    });

    // 3. Fetch Approved Expense records within range
    const expenseWhere: any = {
      expenseDate: { gte: start, lte: end },
      approvalStatus: ExpenseApprovalStatus.APPROVED,
    };
    if (query.expenseCategory) expenseWhere.categoryCode = query.expenseCategory;
    if (query.paymentChannel) expenseWhere.paymentChannel = query.paymentChannel;
    if (query.landLocationId) expenseWhere.landLocationId = query.landLocationId;

    const expenseRecords = await this.prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { expenseDate: 'desc' },
    });

    // 4. Aggregate Revenue by Category
    const revenueByCategory: Record<string, number> = {};
    let totalRevenue = 0;

    for (const p of customerPayments) {
      const amt = Number(p.amount);
      totalRevenue += amt;
      const catLabel =
        p.paymentCategory === PaymentCategory.INITIAL_DEPOSIT
          ? 'Land Sale Deposits'
          : p.paymentCategory === PaymentCategory.INSTALMENT
          ? 'Plot Instalment Payments'
          : p.paymentCategory === PaymentCategory.FULL_OUTRIGHT
          ? 'Outright Plot Purchases'
          : p.paymentCategory === PaymentCategory.LEGAL_DOCUMENTATION_FEE
          ? 'Documentation & Titling Fees'
          : p.paymentCategory === PaymentCategory.SURVEY_INDENTURE_FEE
          ? 'Survey & Indenture Fees'
          : p.paymentCategory === PaymentCategory.RESERVATION_FEE
          ? 'Reservation Fees'
          : String(p.paymentCategory || 'Customer Payments').replace(/_/g, ' ');
      revenueByCategory[catLabel] = (revenueByCategory[catLabel] || 0) + amt;
    }

    for (const inc of standaloneIncomeRecords) {
      const amt = Number(inc.amount);
      totalRevenue += amt;
      const catLabel = inc.sourceCategory.replace(/_/g, ' ');
      revenueByCategory[catLabel] = (revenueByCategory[catLabel] || 0) + amt;
    }

    // 5. Aggregate Expenses by Category & Segment Outflow Types
    const expensesByCategory: Record<string, number> = {};
    const operationalExpensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let totalLandownerDisbursements = 0;
    let totalRefundDisbursements = 0;
    let totalOperationalExpenses = 0;

    for (const exp of expenseRecords) {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      expensesByCategory[exp.categoryCode] = (expensesByCategory[exp.categoryCode] || 0) + amt;

      const isLandowner =
        exp.landownerPaymentId !== null ||
        exp.categoryCode === ExpenseCategoryCode.LANDOWNER_PAYMENT ||
        exp.categoryCode === ExpenseCategoryCode.LAND_ACQUISITION;

      const isRefund =
        exp.refundPaymentId !== null ||
        exp.categoryCode === ExpenseCategoryCode.CUSTOMER_REFUND_DISBURSEMENT;

      if (isLandowner) {
        totalLandownerDisbursements += amt;
      } else if (isRefund) {
        totalRefundDisbursements += amt;
      } else {
        totalOperationalExpenses += amt;
        operationalExpensesByCategory[exp.categoryCode] =
          (operationalExpensesByCategory[exp.categoryCode] || 0) + amt;
      }
    }

    // 6. Net Profit Calculations:
    // Core Operational Profit (Excluding Landowner Disbursements & Refunds)
    const netOperationalProfit = totalRevenue - totalOperationalExpenses;
    const operationalProfitMarginPercentage =
      totalRevenue > 0 ? Number(((netOperationalProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // Overall Net Cash Flow (After Landowner Disbursements & Customer Refunds)
    const netOverallCashFlow = totalRevenue - totalExpenses;
    const overallCashMarginPercentage =
      totalRevenue > 0 ? Number(((netOverallCashFlow / totalRevenue) * 100).toFixed(1)) : 0;

    // 7. Balance Sheet Receivables & Payables Snapshot
    const [receivablesAgg, payablesAgg] = await Promise.all([
      this.prisma.plotAllocation.aggregate({
        where: {
          status: { in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT] },
        },
        _sum: { outstandingBalance: true },
      }),
      this.prisma.landownerAgreement.aggregate({
        _sum: { outstandingBalance: true },
      }),
    ]);

    const totalReceivables = Number(receivablesAgg._sum.outstandingBalance) || 0;
    const totalLandownerPayables = Number(payablesAgg._sum.outstandingBalance) || 0;

    return {
      period: {
        label,
        startDate: start,
        endDate: end,
      },
      summary: {
        totalRevenue,
        grossRevenue: totalRevenue,

        // Core Operational Finances (Excl. Landowner Disbursements & Refunds)
        totalOperationalExpenses,
        netOperationalProfit,
        operationalProfitMarginPercentage,

        // Capital Outlays & Payouts
        totalLandownerDisbursements,
        totalRefundDisbursements,

        // Overall Cash Movement & Totals
        totalOutflow: totalExpenses,
        totalExpenses,
        netOverallCashFlow,
        netProfit: netOverallCashFlow,
        netOperatingIncome: netOperationalProfit,
        profitMarginPercentage: overallCashMarginPercentage,
      },
      revenueBreakdown: revenueByCategory,
      expenseBreakdown: expensesByCategory,
      operationalExpenseBreakdown: operationalExpensesByCategory,
      balanceSheetNotes: {
        customerReceivablesOutstanding: totalReceivables,
        landownerObligationsOutstanding: totalLandownerPayables,
      },
      incomeRecordsCount: customerPayments.length + standaloneIncomeRecords.length,
      expenseRecordsCount: expenseRecords.length,
    };
  }

  /**
   * EXCEL STATEMENT EXPORTER
   */
  async exportExcel(query: FinancialReportQueryDto) {
    const { start, end, label } = this.resolveDateRange(query);
    const settings = await this.settingsService.getSettings(false);

    const [customerPayments, standaloneIncome, expenseRecords] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where: { paymentDate: { gte: start, lte: end }, isReversed: false },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          allocation: { include: { plot: { include: { landLocation: true } } } },
        },
        orderBy: { paymentDate: 'desc' },
      }),
      this.prisma.incomeTransaction.findMany({
        where: { transactionDate: { gte: start, lte: end }, customerPaymentId: null },
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
        orderBy: { expenseDate: 'desc' },
      }),
    ]);

    const totalRevenue =
      customerPayments.reduce((sum, r) => sum + Number(r.amount), 0) +
      standaloneIncome.reduce((sum, r) => sum + Number(r.amount), 0);

    const approvedExpenses = expenseRecords.filter((e) => e.approvalStatus === ExpenseApprovalStatus.APPROVED);

    let totalLandownerDisbursements = 0;
    let totalRefundDisbursements = 0;
    let totalOperationalExpenses = 0;
    let totalExpenses = 0;

    for (const exp of approvedExpenses) {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const isLandowner =
        exp.landownerPaymentId !== null ||
        exp.categoryCode === ExpenseCategoryCode.LANDOWNER_PAYMENT ||
        exp.categoryCode === ExpenseCategoryCode.LAND_ACQUISITION;
      const isRefund =
        exp.refundPaymentId !== null ||
        exp.categoryCode === ExpenseCategoryCode.CUSTOMER_REFUND_DISBURSEMENT;

      if (isLandowner) {
        totalLandownerDisbursements += amt;
      } else if (isRefund) {
        totalRefundDisbursements += amt;
      } else {
        totalOperationalExpenses += amt;
      }
    }

    const netOperationalProfit = totalRevenue - totalOperationalExpenses;
    const netOverallCashFlow = totalRevenue - totalExpenses;

    return this.excelService.generateFinancialWorkbook({
      companyName: settings.companyName,
      reportTitle: 'Financial Performance & Cash Flow Statement',
      periodDescription: label,
      currencySymbol: settings.currencySymbol,
      incomeRecords: [
        ...customerPayments.map((p) => ({
          transactionRef: p.transactionReference,
          transactionDate: p.paymentDate,
          sourceCategory: p.paymentCategory,
          description: `Customer payment: ${p.customer.firstName} ${p.customer.lastName} (${p.allocation?.plot?.plotNumber || 'Plot'})`,
          paymentChannel: p.paymentChannel,
          amount: Number(p.amount),
        })),
        ...standaloneIncome.map((i) => ({
          transactionRef: i.transactionRef,
          transactionDate: i.transactionDate,
          sourceCategory: i.sourceCategory,
          description: i.description,
          paymentChannel: i.paymentChannel,
          amount: Number(i.amount),
        })),
      ],
      expenseRecords: expenseRecords.map((e) => ({
        expenseReference: e.expenseReference,
        expenseDate: e.expenseDate,
        categoryCode: e.categoryCode,
        recipient: e.recipient,
        description: e.description,
        paymentChannel: e.paymentChannel,
        amount: Number(e.amount),
        approvalStatus: e.approvalStatus,
        isLandowner:
          e.landownerPaymentId !== null ||
          e.categoryCode === ExpenseCategoryCode.LANDOWNER_PAYMENT ||
          e.categoryCode === ExpenseCategoryCode.LAND_ACQUISITION,
        isRefund:
          e.refundPaymentId !== null ||
          e.categoryCode === ExpenseCategoryCode.CUSTOMER_REFUND_DISBURSEMENT,
      })),
      summary: {
        totalRevenue,
        totalExpenses,
        totalOperationalExpenses,
        netOperationalProfit,
        totalLandownerDisbursements,
        totalRefundDisbursements,
        netOverallCashFlow,
      },
    });
  }

  /**
   * PDF STATEMENT EXPORTER
   */
  async exportPdf(query: FinancialReportQueryDto, staffUserId: string) {
    const pnl = await this.getProfitAndLoss(query);
    const settings = await this.settingsService.getSettings(false);
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: { firstName: true, lastName: true },
    });

    return this.pdfService.generateFinancialStatementPdf({
      companyName: settings.companyName,
      companyTagline: settings.companyTagline || undefined,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyAddress: settings.companyAddress,
      currencySymbol: settings.currencySymbol,
      reportTitle: 'Statement of Cash Flow & Operating Performance',
      periodDescription: pnl.period.label,
      revenueSummary: pnl.revenueBreakdown,
      expenseSummary: pnl.expenseBreakdown,
      operationalExpenseSummary: pnl.operationalExpenseBreakdown,
      totalRevenue: pnl.summary.totalRevenue,
      totalExpenses: pnl.summary.totalExpenses,
      totalOperationalExpenses: pnl.summary.totalOperationalExpenses,
      netOperationalProfit: pnl.summary.netOperationalProfit,
      totalLandownerDisbursements: pnl.summary.totalLandownerDisbursements,
      totalRefundDisbursements: pnl.summary.totalRefundDisbursements,
      netOverallCashFlow: pnl.summary.netOverallCashFlow,
      netOperatingIncome: pnl.summary.netOperationalProfit,
      totalReceivablesOutstanding: pnl.balanceSheetNotes.customerReceivablesOutstanding,
      generatedByName: staff ? `${staff.firstName} ${staff.lastName}` : 'Accounts Officer',
    });
  }
}

