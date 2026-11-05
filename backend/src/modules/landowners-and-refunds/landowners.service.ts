import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { CreateLandownerDto } from './dto/create-landowner.dto';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { RecordLandownerPaymentDto } from './dto/record-landowner-payment.dto';
import {
  ExpenseCategoryCode,
  ExpenseApprovalStatus,
  AuditAction,
  UserRole,
} from '@prisma/client';

@Injectable()
export class LandownersService {
  private readonly logger = new Logger(LandownersService.name);

  constructor(
    private prisma: PrismaService,
    private voucherPdf: VoucherPdfService,
    private settingsService: SettingsService,
  ) {}

  async createLandowner(dto: CreateLandownerDto) {
    return this.prisma.landowner.create({
      data: {
        fullName: dto.fullName.trim(),
        telephone: dto.telephone.trim(),
        altTelephone: dto.altTelephone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        residentialAddress: dto.residentialAddress.trim(),
        bankName: dto.bankName?.trim(),
        bankAccountNumber: dto.bankAccountNumber?.trim(),
        bankBranch: dto.bankBranch?.trim(),
        momoNumber: dto.momoNumber?.trim(),
      },
    });
  }

  async findAllLandowners() {
    return this.prisma.landowner.findMany({
      include: {
        agreements: {
          include: {
            landLocation: {
              select: { id: true, name: true, region: true },
            },
          },
        },
        _count: {
          select: {
            paymentsReceived: true,
            agreements: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneLandowner(id: string) {
    const landowner = await this.prisma.landowner.findUnique({
      where: { id },
      include: {
        agreements: {
          include: {
            landLocation: true,
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
        paymentsReceived: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!landowner) {
      throw new NotFoundException(`Landowner record with ID '${id}' not found.`);
    }

    // Financial totals across all agreements
    const totalPayable = landowner.agreements.reduce((sum, a) => sum + Number(a.agreedTotalAmount), 0);
    const totalPaid = landowner.agreements.reduce((sum, a) => sum + Number(a.totalPaidAmount), 0);
    const totalBalance = landowner.agreements.reduce((sum, a) => sum + Number(a.outstandingBalance), 0);

    return {
      landowner,
      financialSummary: {
        totalPayable,
        totalPaid,
        totalBalance,
      },
    };
  }

  async createAgreement(dto: CreateAgreementDto, staffUserId: string) {
    const [landowner, location] = await Promise.all([
      this.prisma.landowner.findUnique({ where: { id: dto.landownerId } }),
      this.prisma.landLocation.findUnique({ where: { id: dto.landLocationId } }),
    ]);

    if (!landowner) throw new NotFoundException(`Landowner with ID '${dto.landownerId}' not found.`);
    if (!location) throw new NotFoundException(`Land Location with ID '${dto.landLocationId}' not found.`);

    const count = await this.prisma.landownerAgreement.count();
    const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
    const agreementNumber = `LOA-${dateCode}-${String(count + 1).padStart(4, '0')}`;

    const totalAgreed = Number(dto.agreedTotalAmount);

    return this.prisma.landownerAgreement.create({
      data: {
        agreementNumber,
        landownerId: dto.landownerId,
        landLocationId: dto.landLocationId,
        agreedTotalAmount: totalAgreed,
        totalPaidAmount: 0,
        outstandingBalance: totalAgreed,
        signedDate: new Date(dto.signedDate),
        contractDocumentUrl: dto.contractDocumentUrl,
        termsNotes: dto.termsNotes?.trim(),
      },
      include: {
        landowner: true,
        landLocation: true,
      },
    });
  }

  /**
   * CRITICAL LANDOWNER DISBURSEMENT WORKFLOW:
   * Staff records external payment disbursed to landowner (MoMo Transfer, Bank Transfer, Cash, Cheque),
   * updates agreement balance, generates PDF payment voucher, and logs entry in corporate Expense engine.
   */
  async recordLandownerPayment(dto: RecordLandownerPaymentDto, staffUser: { id: string; role: UserRole }) {
    const agreement = await this.prisma.landownerAgreement.findUnique({
      where: { id: dto.agreementId },
      include: {
        landowner: true,
        landLocation: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Landowner Agreement with ID '${dto.agreementId}' not found.`);
    }

    const currentTotalAgreed = Number(agreement.agreedTotalAmount);
    const currentPaid = Number(agreement.totalPaidAmount);
    const payoutAmount = Number(dto.amount);

    if (payoutAmount > Number(agreement.outstandingBalance)) {
      throw new BadRequestException(
        `Disbursement amount of GHS ${payoutAmount.toLocaleString()} exceeds remaining balance of GHS ${Number(agreement.outstandingBalance).toLocaleString()}.`,
      );
    }

    const newTotalPaid = currentPaid + payoutAmount;
    const newBalance = Math.max(0, currentTotalAgreed - newTotalPaid);

    // Generate unique Voucher Reference: VOU-YYYYMM-XXXX
    const today = new Date();
    const monthStr = today.toISOString().slice(0, 7).replace('-', '');
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countVou = await this.prisma.landownerPayment.count();
    const voucherNumber = `VOU-${monthStr}-${String(countVou + 1).padStart(4, '0')}`;

    // Fetch system settings for corporate branding
    const settings = await this.settingsService.getSettings(false);

    // Staff details
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { firstName: true, lastName: true },
    });
    const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Accounts Officer';

    // Generate PDF Voucher
    let pdfVoucherUrl = `/uploads/documents/Voucher_${voucherNumber}.pdf`;
    try {
      const generated = await this.voucherPdf.generateLandownerVoucherPdf({
        voucherNumber,
        agreementNumber: agreement.agreementNumber,
        landownerName: agreement.landowner.fullName,
        landownerPhone: agreement.landowner.telephone,
        landLocationName: agreement.landLocation.name,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : today,
        amount: payoutAmount,
        outstandingBalanceAfter: newBalance,
        totalAgreedAmount: currentTotalAgreed,
        totalPaidAmount: newTotalPaid,
        paymentChannel: dto.paymentChannel,
        bankTransactionRef: dto.bankTransactionRef,
        chequeNumber: dto.chequeNumber,
        remarks: dto.remarks,
        companyName: settings.companyName,
        companyTagline: settings.companyTagline || undefined,
        companyEmail: settings.companyEmail,
        companyPhone: settings.companyPhone,
        companyAddress: settings.companyAddress,
        currencySymbol: settings.currencySymbol,
        authorizingOfficerName: staffName,
      });
      pdfVoucherUrl = generated.pdfUrl;
    } catch (pdfErr) {
      this.logger.error(`Error generating landowner voucher PDF: ${pdfErr.message}`);
    }

    // Atomic transaction: Record LandownerPayment + Update Agreement + Create Corporate Expense
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create LandownerPayment record
      const payment = await tx.landownerPayment.create({
        data: {
          voucherNumber,
          agreementId: agreement.id,
          landownerId: agreement.landownerId,
          amount: payoutAmount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : today,
          paymentChannel: dto.paymentChannel,
          bankTransactionRef: dto.bankTransactionRef?.trim(),
          chequeNumber: dto.chequeNumber?.trim(),
          recordedByUserId: staffUser.id,
          pdfVoucherUrl,
          remarks: dto.remarks?.trim(),
        },
      });

      // 2. Update Agreement Balance
      await tx.landownerAgreement.update({
        where: { id: agreement.id },
        data: {
          totalPaidAmount: newTotalPaid,
          outstandingBalance: newBalance,
        },
      });

      // 3. Link directly to corporate Expense ledger (avoids double counting)
      const countExp = await tx.expense.count();
      const expenseReference = `EXP-${dateStr}-${String(countExp + 1).padStart(4, '0')}`;
      await tx.expense.create({
        data: {
          expenseReference,
          landLocationId: agreement.landLocationId,
          landownerPaymentId: payment.id,
          categoryCode: ExpenseCategoryCode.LANDOWNER_PAYMENT,
          description: `Disbursement to Landowner ${agreement.landowner.fullName} for acquisition agreement ${agreement.agreementNumber} (${agreement.landLocation.name})`,
          amount: payoutAmount,
          currency: 'GHS',
          expenseDate: payment.paymentDate,
          paymentChannel: dto.paymentChannel,
          recipient: agreement.landowner.fullName,
          supportingReceiptUrl: pdfVoucherUrl,
          recordedByUserId: staffUser.id,
          approvalStatus: ExpenseApprovalStatus.APPROVED,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.CREATE,
          entityName: 'LandownerPayment',
          entityId: payment.id,
          newValues: {
            voucherNumber,
            landownerName: agreement.landowner.fullName,
            locationName: agreement.landLocation.name,
            amount: payoutAmount,
            channel: dto.paymentChannel,
            newBalance,
          },
        },
      });

      return {
        payment,
        newBalance,
      };
    });

    return {
      message: `Landowner payment of GHS ${payoutAmount.toLocaleString()} recorded. Voucher #: ${voucherNumber}.`,
      payment: result.payment,
      outstandingBalance: result.newBalance,
    };
  }
}
