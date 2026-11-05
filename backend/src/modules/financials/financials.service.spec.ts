import { Test, TestingModule } from '@nestjs/testing';
import { FinancialsService } from './financials.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialExcelService } from './financial-excel.service';
import { FinancialPdfService } from './financial-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { ForbiddenException } from '@nestjs/common';
import {
  UserRole,
  ExpenseCategoryCode,
  ExpenseApprovalStatus,
  PaymentChannel,
  IncomeSourceCategory,
} from '@prisma/client';

describe('FinancialsService (Stage 7 Financial Management Verification)', () => {
  let service: FinancialsService;
  let prismaService: any;
  let excelService: any;
  let pdfService: any;
  let settingsService: any;

  const mockAdmin = { id: 'admin-uuid-1', role: UserRole.ADMINISTRATOR };
  const mockMD = { id: 'md-uuid-1', role: UserRole.MANAGING_DIRECTOR };
  const mockAgent = { id: 'agent-uuid-1', role: UserRole.SALES_AGENT };

  beforeEach(async () => {
    prismaService = {
      expense: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      incomeTransaction: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      plotAllocation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { outstandingBalance: 120000 } }),
      },
      landownerAgreement: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { outstandingBalance: 400000 } }),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Fin', lastName: 'Officer' }),
      },
    };

    excelService = {
      generateFinancialWorkbook: jest.fn().mockResolvedValue({
        fileUrl: '/uploads/documents/Financial_Report_2026-11-05.xlsx',
        filePath: 'Financial_Report_2026-11-05.xlsx',
      }),
    };

    pdfService = {
      generateFinancialStatementPdf: jest.fn().mockResolvedValue({
        pdfUrl: '/uploads/documents/Financial_Statement_2026-11-05.pdf',
        filePath: 'Financial_Statement_2026-11-05.pdf',
      }),
    };

    settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        companyName: 'Ghana Real Estate Developers',
        currencySymbol: 'GH₵',
        companyEmail: 'info@realestatedev.gh',
        companyPhone: '+233 30 000 0000',
        companyAddress: 'Accra, Ghana',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: FinancialExcelService, useValue: excelService },
        { provide: FinancialPdfService, useValue: pdfService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<FinancialsService>(FinancialsService);
  });

  it('should record an operational expense under threshold as automatically APPROVED', async () => {
    prismaService.expense.create.mockImplementation(({ data }) => ({
      id: 'exp-uuid-1',
      ...data,
    }));

    const result = await service.recordExpense(
      {
        categoryCode: ExpenseCategoryCode.SITE_DEVELOPMENT_SURVEY,
        description: 'Bulldozer fuel and operator allowance',
        amount: 2500, // Under 5,000 threshold
        paymentChannel: PaymentChannel.MOBILE_MONEY_MTN,
        recipient: 'Kwesi Fuel Station',
      },
      mockAdmin,
    );

    expect(result.expense.approvalStatus).toEqual(ExpenseApprovalStatus.APPROVED);
    expect(prismaService.auditLog.create).toHaveBeenCalled();
  });

  it('should set expense status to PENDING_MD_APPROVAL when amount exceeds GHS 5,000 threshold', async () => {
    prismaService.expense.create.mockImplementation(({ data }) => ({
      id: 'exp-uuid-2',
      ...data,
    }));

    const result = await service.recordExpense(
      {
        categoryCode: ExpenseCategoryCode.MARKETING_ADVERTISING,
        description: 'National Billboard Campaign Q4 in Accra & Kumasi',
        amount: 35000, // Exceeds 5,000 threshold
        paymentChannel: PaymentChannel.BANK_TRANSFER,
        recipient: 'DDP Outdoor Media Ltd.',
      },
      mockAdmin,
    );

    expect(result.expense.approvalStatus).toEqual(ExpenseApprovalStatus.PENDING_MD_APPROVAL);
  });

  it('should allow Managing Director to approve pending major expense', async () => {
    const pendingExpense = {
      id: 'exp-uuid-2',
      expenseReference: 'EXP-20261105-0002',
      amount: 35000,
      approvalStatus: ExpenseApprovalStatus.PENDING_MD_APPROVAL,
    };
    prismaService.expense.findUnique.mockResolvedValue(pendingExpense);
    prismaService.expense.update.mockResolvedValue({
      ...pendingExpense,
      approvalStatus: ExpenseApprovalStatus.APPROVED,
    });

    const result = await service.approveExpense('exp-uuid-2', { approved: true }, mockMD);

    expect(result.message).toContain('status updated to APPROVED');
  });

  it('should reject approval attempt made by unauthorized Sales Agent', async () => {
    await expect(
      service.approveExpense('exp-uuid-2', { approved: true }, mockAgent),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should record other miscellaneous operational business income', async () => {
    prismaService.incomeTransaction.create.mockImplementation(({ data }) => ({
      id: 'inc-uuid-1',
      ...data,
    }));

    const result = await service.recordIncome(
      {
        sourceCategory: IncomeSourceCategory.OTHER_OPERATIONAL_INCOME,
        description: 'Client site tour bus transportation and consultation fee',
        amount: 500,
        paymentChannel: PaymentChannel.CASH,
      },
      mockAdmin,
    );

    expect(result.income.amount).toEqual(500);
  });

  it('should calculate accurate Profit & Loss statement (Net Income = Total Revenue - Total Expenses)', async () => {
    // 2 Income entries: 50,000 + 15,000 = 65,000
    prismaService.incomeTransaction.findMany.mockResolvedValue([
      { sourceCategory: 'LAND_SALE_DEPOSIT', amount: 50000 },
      { sourceCategory: 'LAND_SALE_INSTALMENT', amount: 15000 },
    ]);

    // 2 Expense entries: 12,000 + 3,000 = 15,000
    prismaService.expense.findMany.mockResolvedValue([
      { categoryCode: 'LANDOWNER_PAYMENT', amount: 12000, approvalStatus: ExpenseApprovalStatus.APPROVED },
      { categoryCode: 'TRANSPORTATION_FUEL', amount: 3000, approvalStatus: ExpenseApprovalStatus.APPROVED },
    ]);

    const result = await service.getProfitAndLoss({ period: undefined });

    expect(result.summary.totalRevenue).toEqual(65000);
    expect(result.summary.totalExpenses).toEqual(15000);
    expect(result.summary.netOperatingIncome).toEqual(50000); // 65,000 - 15,000
    expect(result.balanceSheetNotes.customerReceivablesOutstanding).toEqual(120000);
    expect(result.balanceSheetNotes.landownerObligationsOutstanding).toEqual(400000);
  });
});
