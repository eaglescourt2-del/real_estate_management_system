import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { SettingsService } from '../settings/settings.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  UserRole,
  AllocationStatus,
  PaymentCategory,
  PaymentChannel,
  PaymentVerificationStatus,
} from '@prisma/client';

describe('PaymentsService (Stage 5 Payment Management Verification)', () => {
  let service: PaymentsService;
  let prismaService: any;
  let pdfGenerator: any;
  let settingsService: any;

  const mockAdmin = { id: 'admin-uuid-1', role: UserRole.ADMINISTRATOR };
  const mockMD = { id: 'md-uuid-1', role: UserRole.MANAGING_DIRECTOR };
  const mockAgent = { id: 'agent-uuid-1', role: UserRole.SALES_AGENT };

  const mockAllocation = {
    id: 'alc-uuid-1',
    allocationNumber: 'ALC-202611-0001',
    customerId: 'cust-uuid-1',
    salesAgentId: 'agent-uuid-1',
    agreedPrice: 50000,
    depositRequired: 10000,
    totalAmountPaid: 10000,
    outstandingBalance: 40000,
    status: AllocationStatus.ACTIVE_INSTALMENT,
    customer: {
      id: 'cust-uuid-1',
      customerNumber: 'CUST-202611-0001',
      firstName: 'Kofi',
      lastName: 'Mensah',
      telephone: '+233244123456',
    },
    plot: {
      plotNumber: 'Plot 10',
      dimensions: '70ft x 100ft',
      landLocation: {
        name: 'Prampram Palms Phase 2',
      },
    },
  };

  beforeEach(async () => {
    prismaService = {
      plotAllocation: {
        findUnique: jest.fn().mockResolvedValue(mockAllocation),
        update: jest.fn(),
      },
      customerPayment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      receipt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      incomeTransaction: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      notificationLog: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Ops', lastName: 'Admin' }),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    pdfGenerator = {
      generateReceiptPdf: jest.fn().mockResolvedValue({
        pdfUrl: '/uploads/documents/Receipt_RCT-202611-0001.pdf',
        filePath: 'Receipt_RCT-202611-0001.pdf',
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
        PaymentsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PdfGeneratorService, useValue: pdfGenerator },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should record an instalment payment, decrement outstanding balance, and generate serialized receipt', async () => {
    prismaService.customerPayment.create.mockImplementation(({ data }) => ({
      id: 'pay-uuid-1',
      ...data,
    }));
    prismaService.receipt.create.mockImplementation(({ data }) => ({
      id: 'rct-uuid-1',
      ...data,
    }));

    const result = await service.recordPayment(
      {
        allocationId: 'alc-uuid-1',
        amount: 15000,
        paymentCategory: PaymentCategory.INSTALMENT,
        paymentChannel: PaymentChannel.MOBILE_MONEY_MTN,
        externalGatewayRef: 'MTN-91823901',
      },
      mockAdmin,
    );

    // Initial paid: 10,000 + 15,000 = 25,000; Balance: 50,000 - 25,000 = 25,000
    expect(result.outstandingBalance).toEqual(25000);
    expect(prismaService.plotAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alc-uuid-1' },
        data: expect.objectContaining({
          totalAmountPaid: 25000,
          outstandingBalance: 25000,
        }),
      }),
    );
    // Verifies linked IncomeTransaction creation
    expect(prismaService.incomeTransaction.create).toHaveBeenCalled();
    // Verifies PDF receipt generation
    expect(pdfGenerator.generateReceiptPdf).toHaveBeenCalled();
  });

  it('should transition allocation status to PAID_IN_FULL when balance reaches 0', async () => {
    prismaService.customerPayment.create.mockImplementation(({ data }) => ({
      id: 'pay-uuid-2',
      ...data,
    }));
    prismaService.receipt.create.mockImplementation(({ data }) => ({
      id: 'rct-uuid-2',
      ...data,
    }));

    // Current paid is 10k, agreed is 50k -> Paying 40,000 pays off the plot!
    const result = await service.recordPayment(
      {
        allocationId: 'alc-uuid-1',
        amount: 40000,
        paymentCategory: PaymentCategory.INSTALMENT,
        paymentChannel: PaymentChannel.BANK_TRANSFER,
      },
      mockAdmin,
    );

    expect(result.outstandingBalance).toEqual(0);
    expect(result.allocationStatus).toEqual(AllocationStatus.PAID_IN_FULL);
  });

  it('should allow Managing Director to authorize a payment reversal with audit log', async () => {
    const paymentToReverse = {
      id: 'pay-uuid-1',
      transactionReference: 'TXN-20261105-0001',
      amount: 10000,
      isReversed: false,
      allocation: {
        id: 'alc-uuid-1',
        totalAmountPaid: 20000,
        outstandingBalance: 30000,
      },
      incomeTransaction: { id: 'inc-uuid-1' },
    };

    prismaService.customerPayment.findUnique.mockResolvedValue(paymentToReverse);

    const result = await service.reversePayment(
      'pay-uuid-1',
      { reversalReason: 'Cheque bounced due to signature error. Reversal approved by MD.' },
      mockMD,
    );

    expect(result.message).toContain('TXN-20261105-0001 of GHS 10,000 has been authorized and reversed');
    expect(result.adjustedAllocation.newTotalPaid).toEqual(10000);
    expect(result.adjustedAllocation.newOutstandingBalance).toEqual(40000);
    expect(prismaService.auditLog.create).toHaveBeenCalled();
  });

  it('should forbid Sales Agent from reversing a payment', async () => {
    await expect(
      service.reversePayment(
        'pay-uuid-1',
        { reversalReason: 'Agent attempted reversal' },
        mockAgent,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
