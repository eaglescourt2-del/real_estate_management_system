import { Test, TestingModule } from '@nestjs/testing';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  UserRole,
  RefundStatus,
  PlotStatus,
  AllocationStatus,
  PaymentChannel,
} from '@prisma/client';

describe('RefundsService (Stage 6 Customer Refund Verification)', () => {
  let service: RefundsService;
  let prismaService: any;
  let voucherPdf: any;
  let settingsService: any;

  const mockAdmin = { id: 'admin-uuid-1', role: UserRole.ADMINISTRATOR };
  const mockMD = { id: 'md-uuid-1', role: UserRole.MANAGING_DIRECTOR };
  const mockAgent = { id: 'agent-uuid-1', role: UserRole.SALES_AGENT };

  const mockCustomer = {
    id: 'cust-uuid-1',
    customerNumber: 'CUST-202611-0001',
    firstName: 'Kwabena',
    lastName: 'Darko',
    telephone: '+233244111222',
  };

  const mockAllocation = {
    id: 'alc-uuid-1',
    customerId: 'cust-uuid-1',
    plotId: 'plot-uuid-1',
    agreedPrice: 60000,
    totalAmountPaid: 30000,
    outstandingBalance: 30000,
    status: AllocationStatus.ACTIVE_INSTALMENT,
    plot: {
      id: 'plot-uuid-1',
      plotNumber: 'Plot 15',
      landLocationId: 'loc-uuid-1',
      landLocation: { name: 'Prampram Palms' },
    },
  };

  beforeEach(async () => {
    prismaService = {
      customer: { findUnique: jest.fn().mockResolvedValue(mockCustomer) },
      plotAllocation: {
        findFirst: jest.fn().mockResolvedValue(mockAllocation),
        update: jest.fn(),
      },
      plot: { update: jest.fn() },
      refundRequest: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refundPayment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      expense: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      notificationLog: { create: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Managing', lastName: 'Director' }),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    voucherPdf = {
      generateRefundStatementPdf: jest.fn().mockResolvedValue({
        pdfUrl: '/uploads/documents/Refund_Statement_REF-202611-0001.pdf',
        filePath: 'Refund_Statement_REF-202611-0001.pdf',
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
        RefundsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: VoucherPdfService, useValue: voucherPdf },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  it('should create refund request with formula (Net = Paid - Deductions) and quarantine plot to CANCELLED', async () => {
    prismaService.refundRequest.create.mockImplementation(({ data }) => ({
      id: 'ref-uuid-1',
      refundNumber: 'REF-202611-0001',
      ...data,
    }));

    const result = await service.createRefundRequest(
      {
        customerId: 'cust-uuid-1',
        plotId: 'plot-uuid-1',
        reason: 'Customer relocated out of the country',
        deductions: [
          { deductionName: 'Administrative Fee', amount: 3000, explanation: '10% deduction' },
          { deductionName: 'Survey Cost', amount: 1000, explanation: 'Pegging inspection' },
        ],
      },
      mockAdmin,
    );

    // Paid: 30,000; Deductions: 4,000; Net Refund = 26,000
    expect(result.refund.netRefundAmount).toEqual(26000);
    // Verifies plot quarantine
    expect(prismaService.plot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plot-uuid-1' },
        data: expect.objectContaining({ status: PlotStatus.CANCELLED }),
      }),
    );
    // Verifies allocation cancelled
    expect(prismaService.plotAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alc-uuid-1' },
        data: expect.objectContaining({ status: AllocationStatus.CANCELLED }),
      }),
    );
  });

  it('should allow Managing Director to approve refund and generate statement PDF', async () => {
    const mockRefund = {
      id: 'ref-uuid-1',
      refundNumber: 'REF-202611-0001',
      status: RefundStatus.REQUESTED,
      netRefundAmount: 26000,
      totalPaymentsReceived: 30000,
      totalDeductions: 4000,
      customer: mockCustomer,
      plot: { plotNumber: 'Plot 15', landLocation: { name: 'Prampram Palms' } },
      deductions: [],
      reason: 'Relocated',
      createdAt: new Date(),
    };
    prismaService.refundRequest.findUnique.mockResolvedValue(mockRefund);
    prismaService.refundRequest.update.mockResolvedValue({
      ...mockRefund,
      status: RefundStatus.APPROVED,
    });

    const result = await service.approveRefund('ref-uuid-1', { approved: true }, mockMD);

    expect(result.message).toContain('successfully approved by Managing Director');
    expect(voucherPdf.generateRefundStatementPdf).toHaveBeenCalled();
  });

  it('should reject approval attempt if made by unauthorized Sales Agent', async () => {
    await expect(
      service.approveRefund('ref-uuid-1', { approved: true }, mockAgent),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should record external refund disbursement (Mobile Money Transfer) and log corporate expense', async () => {
    const mockApprovedRefund = {
      id: 'ref-uuid-1',
      refundNumber: 'REF-202611-0001',
      customerId: 'cust-uuid-1',
      status: RefundStatus.APPROVED,
      netRefundAmount: 26000,
      totalRefundPaid: 0,
      remainingRefundDue: 26000,
      customer: mockCustomer,
      plot: { landLocationId: 'loc-uuid-1', plotNumber: 'Plot 15' },
    };
    prismaService.refundRequest.findUnique.mockResolvedValue(mockApprovedRefund);
    prismaService.refundPayment.create.mockImplementation(({ data }) => ({
      id: 'rfd-uuid-1',
      ...data,
    }));

    const result = await service.disburseRefundPayment(
      'ref-uuid-1',
      {
        amount: 10000,
        paymentChannel: PaymentChannel.MOBILE_MONEY_MTN,
        transactionReference: 'MTN-REF-890123',
      },
      mockAdmin,
    );

    // Initial due 26k - 10k paid = 16k remaining due; status PARTIALLY_REFUNDED
    expect(result.remainingRefundDue).toEqual(16000);
    expect(result.refundStatus).toEqual(RefundStatus.PARTIALLY_REFUNDED);
    expect(prismaService.expense.create).toHaveBeenCalled();
  });
});
