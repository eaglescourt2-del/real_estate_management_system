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
   * Staff records external payment disbursed (MoMo, Bank, Cash, Cheque),
   * assigns category, recipient, and enforces MD approval for amounts > GH₵ 5,000.
   */
  async recordExpense(dto: CreateExpenseDto, staffUser: { id: string; role: UserRole }) {
    const expenseAmount = Number(dto.amount);
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.expense.count();
    const expenseReference = `EXP-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Approval status rule: Expenses > 5,000 GHS require MD approval unless created by MD/SuperAdmin
    let approvalStatus: ExpenseApprovalStatus = ExpenseApprovalStatus.APPROVED;
    if (
      expenseAmount > this.MAJOR_EXPENSE_THRESHOLD &&
      staffUser.role !== UserRole.SUPER_ADMINISTRATOR &&
      staffUser.role !== UserRole.MANAGING_DIRECTOR
    ) {
      approvalStatus = ExpenseApprovalStatus.PENDING_MD_APPROVAL;
    }

    const expense = await this.prisma.expense.create({
      data: {
        expenseReference,
        categoryCode: dto.categoryCode,
        description: dto.description.trim(),
        amount: expenseAmount,
        currency: 'GHS',
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : today,
        paymentChannel: dto.paymentChannel,
        recipient: dto.recipient.trim(),
        landLocationId: dto.landLocationId,
        supportingReceiptUrl: dto.supportingReceiptUrl,
        recordedByUserId: staffUser.id,
        approvedByUserId: approvalStatus === ExpenseApprovalStatus.APPROVED ? staffUser.id : null,
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
        userId: staffUser.id,
        action: AuditAction.CREATE,
        entityName: 'Expense',
        entityId: expense.id,
        newValues: {
          expenseReference,
          category: dto.categoryCode,
          amount: expenseAmount,
          channel: dto.paymentChannel,
          recipient: dto.recipient,
          status: approvalStatus,
        },
      },
    });

    return {
      message:
        approvalStatus === ExpenseApprovalStatus.PENDING_MD_APPROVAL
          ? `Expense ${expenseReference} of GHS ${expenseAmount.toLocaleString()} submitted for Managing Director approval (exceeds threshold).`
          : `Expense ${expenseReference} of GHS ${expenseAmount.toLocaleString()} recorded successfully.`,
      expense,
    };
  }

  async approveExpense(id: string, dto: ApproveExpenseDto, staffUser: { id: string; role: UserRole }) {
    if (staffUser.role !== UserRole.SUPER_ADMINISTRATOR && staffUser.role !== UserRole.MANAGING_DIRECTOR) {
      throw new ForbiddenException('Only a Managing Director or Super Administrator can approve major expenses.');
    }

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
    const count = await this.prisma.incomeTransaction.count();
    const transactionRef = `INC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

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
   */
  async getProfitAndLoss(query: FinancialReportQueryDto) {
    const { start, end, label } = this.resolveDateRange(query);

    // 1. Fetch Income records within range
    const incomeWhere: any = {
      transactionDate: { gte: start, lte: end },
    };
    if (query.paymentChannel) incomeWhere.paymentChannel = query.paymentChannel;

    const incomeRecords = await this.prisma.incomeTransaction.findMany({
      where: incomeWhere,
      orderBy: { transactionDate: 'desc' },
    });

    // 2. Fetch Approved Expense records within range
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

    // 3. Aggregate Revenue by Category
    const revenueByCategory: Record<string, number> = {};
    let totalRevenue = 0;
    for (const inc of incomeRecords) {
      const amt = Number(inc.amount);
      totalRevenue += amt;
      revenueByCategory[inc.sourceCategory] = (revenueByCategory[inc.sourceCategory] || 0) + amt;
    }

    // 4. Aggregate Expenses by Category
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    for (const exp of expenseRecords) {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      expensesByCategory[exp.categoryCode] = (expensesByCategory[exp.categoryCode] || 0) + amt;
    }

    // 5. Net Operating Profit / Cash Surplus
    const netOperatingIncome = totalRevenue - totalExpenses;

    // 6. Balance Sheet Receivables & Payables Snapshot
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
        totalExpenses,
        netOperatingIncome,
        profitMarginPercentage: totalRevenue > 0 ? Number(((netOperatingIncome / totalRevenue) * 100).toFixed(1)) : 0,
      },
      revenueBreakdown: revenueByCategory,
      expenseBreakdown: expensesByCategory,
      balanceSheetNotes: {
        customerReceivablesOutstanding: totalReceivables,
        landownerObligationsOutstanding: totalLandownerPayables,
      },
      incomeRecordsCount: incomeRecords.length,
      expenseRecordsCount: expenseRecords.length,
    };
  }

  /**
   * EXCEL STATEMENT EXPORTER
   */
  async exportExcel(query: FinancialReportQueryDto) {
    const { start, end, label } = this.resolveDateRange(query);
    const settings = await this.settingsService.getSettings(false);

    const [incomeRecords, expenseRecords] = await Promise.all([
      this.prisma.incomeTransaction.findMany({
        where: { transactionDate: { gte: start, lte: end } },
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
        orderBy: { expenseDate: 'desc' },
      }),
    ]);

    const totalRevenue = incomeRecords.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpenses = expenseRecords
      .filter((e) => e.approvalStatus === ExpenseApprovalStatus.APPROVED)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    return this.excelService.generateFinancialWorkbook({
      companyName: settings.companyName,
      reportTitle: 'Financial Performance & Cash Flow Statement',
      periodDescription: label,
      currencySymbol: settings.currencySymbol,
      incomeRecords: incomeRecords.map((i) => ({
        transactionRef: i.transactionRef,
        transactionDate: i.transactionDate,
        sourceCategory: i.sourceCategory,
        description: i.description,
        paymentChannel: i.paymentChannel,
        amount: Number(i.amount),
      })),
      expenseRecords: expenseRecords.map((e) => ({
        expenseReference: e.expenseReference,
        expenseDate: e.expenseDate,
        categoryCode: e.categoryCode,
        recipient: e.recipient,
        description: e.description,
        paymentChannel: e.paymentChannel,
        amount: Number(e.amount),
        approvalStatus: e.approvalStatus,
      })),
      summary: {
        totalRevenue,
        totalExpenses,
        netOperatingProfit: totalRevenue - totalExpenses,
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
      totalRevenue: pnl.summary.totalRevenue,
      totalExpenses: pnl.summary.totalExpenses,
      netOperatingIncome: pnl.summary.netOperatingIncome,
      totalReceivablesOutstanding: pnl.balanceSheetNotes.customerReceivablesOutstanding,
      generatedByName: staff ? `${staff.firstName} ${staff.lastName}` : 'Accounts Officer',
    });
  }
}

