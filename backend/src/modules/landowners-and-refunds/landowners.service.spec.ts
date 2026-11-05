import { Test, TestingModule } from '@nestjs/testing';
import { LandownersService } from './landowners.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole, PaymentChannel } from '@prisma/client';

describe('LandownersService (Stage 6 Verification)', () => {
  let service: LandownersService;
  let prismaService: any;
  let voucherPdf: any;
  let settingsService: any;

  const mockAdmin = { id: 'admin-uuid-1', role: UserRole.ADMINISTRATOR };

  const mockAgreement = {
    id: 'agr-uuid-1',
    agreementNumber: 'LOA-202605-0001',
    landownerId: 'lo-uuid-1',
    landLocationId: 'loc-uuid-1',
    agreedTotalAmount: 1000000,
    totalPaidAmount: 200000,
    outstandingBalance: 800000,
    landowner: {
      id: 'lo-uuid-1',
      fullName: 'Nii Kpobi Tettey Tsuru III',
      telephone: '+233244987654',
    },
    landLocation: {
      id: 'loc-uuid-1',
      name: 'Prampram Palms Phase 2',
    },
  };

  beforeEach(async () => {
    prismaService = {
      landownerAgreement: {
        findUnique: jest.fn().mockResolvedValue(mockAgreement),
        update: jest.fn(),
      },
      landownerPayment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      expense: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Accounts', lastName: 'Officer' }),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    voucherPdf = {
      generateLandownerVoucherPdf: jest.fn().mockResolvedValue({
        pdfUrl: '/uploads/documents/Voucher_VOU-202611-0001.pdf',
        filePath: 'Voucher_VOU-202611-0001.pdf',
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
        LandownersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: VoucherPdfService, useValue: voucherPdf },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<LandownersService>(LandownersService);
  });

  it('should record external payment to landowner (Bank Transfer), update balance, generate voucher and log corporate expense', async () => {
    prismaService.landownerPayment.create.mockImplementation(({ data }) => ({
      id: 'lopay-uuid-1',
      ...data,
    }));

    const result = await service.recordLandownerPayment(
      {
        agreementId: 'agr-uuid-1',
        amount: 300000,
        paymentChannel: PaymentChannel.BANK_TRANSFER,
        bankTransactionRef: 'GIP-98401293',
        remarks: 'Tranche #2 payment for phase 2 beacons',
      },
      mockAdmin,
    );

    // Initial paid: 200k + 300k = 500k; Balance: 1,000,000 - 500k = 500,000
    expect(result.outstandingBalance).toEqual(500000);
    expect(prismaService.landownerAgreement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agr-uuid-1' },
        data: expect.objectContaining({
          totalPaidAmount: 500000,
          outstandingBalance: 500000,
        }),
      }),
    );
    // Verifies corporate Expense ledger entry
    expect(prismaService.expense.create).toHaveBeenCalled();
    // Verifies PDF voucher generation
    expect(voucherPdf.generateLandownerVoucherPdf).toHaveBeenCalled();
  });

  it('should reject payment if amount exceeds remaining landowner agreement balance', async () => {
    await expect(
      service.recordLandownerPayment(
        {
          agreementId: 'agr-uuid-1',
          amount: 900000, // Balance is only 800,000
          paymentChannel: PaymentChannel.BANK_TRANSFER,
        },
        mockAdmin,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
