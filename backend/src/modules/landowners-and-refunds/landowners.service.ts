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
import { UpdateLandownerPaymentDto } from './dto/update-landowner-payment.dto';
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

  /**
   * LANDOWNER OBLIGATIONS:
   * Features Land Location, Landowner, Purchase Price, Total Paid, Outstanding Balance,
   * and complete payment history.
   */
  async getObligations() {
    const locations = await this.prisma.landLocation.findMany({
      where: { isActive: true },
      include: {
        landownerAgreements: {
          include: {
            landowner: true,
            payments: {
              orderBy: { paymentDate: 'desc' },
              include: {
                recordedByUser: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return locations
      .filter((loc) => {
        const hasAgreements = loc.landownerAgreements && loc.landownerAgreements.length > 0;
        const hasPrice = loc.purchasePrice != null && Number(loc.purchasePrice) > 0;
        const hasOwner = loc.landownerName != null && loc.landownerName.trim() !== '' && loc.landownerName !== 'Direct Landowner / Stool';
        return hasAgreements || hasPrice || hasOwner;
      })
      .map((loc) => {
        const primaryAgr = loc.landownerAgreements[0];
        const purchasePrice = Number(primaryAgr?.agreedTotalAmount ?? loc.purchasePrice ?? 0);

        const allPayments = loc.landownerAgreements
          .flatMap((a) =>
            a.payments.map((p) => ({
              ...p,
              agreementNumber: a.agreementNumber,
              landownerName: a.landowner?.fullName || loc.landownerName || 'Stool / Family Elder',
              locationName: loc.name,
            })),
          )
          .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const outstandingBalance = Math.max(0, purchasePrice - totalPaid);
        const landownerName = primaryAgr?.landowner?.fullName || loc.landownerName || 'Direct Landowner / Stool';

        return {
          id: loc.id,
          locationId: loc.id,
          locationName: loc.name,
          region: loc.region,
          district: loc.district,
          geographicalAddress: loc.geographicalAddress,
          totalLandSizeAcres: Number(loc.totalLandSizeAcres),
          totalPlotsCount: loc.totalPlotsCount,
          landownerName,
          landownerPhone: primaryAgr?.landowner?.telephone || null,
          purchasePrice,
          totalPaid,
          outstandingBalance,
          agreementId: primaryAgr?.id || null,
          agreementNumber: primaryAgr?.agreementNumber || null,
          payments: allPayments,
          paymentsCount: allPayments.length,
          status: purchasePrice > 0 && outstandingBalance === 0 ? 'PAID_IN_FULL' : totalPaid > 0 ? 'PARTIAL' : 'PENDING',
        };
      });
  }

  /**
   * ACTIVE AGREEMENTS:
   * Returns agreements/locations ready for disbursement.
   */
  async getActiveAgreements() {
    const locations = await this.prisma.landLocation.findMany({
      where: { isActive: true },
      include: {
        landownerAgreements: {
          include: { landowner: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return locations.map((loc) => {
      const agr = loc.landownerAgreements[0];
      const purchasePrice = Number(agr?.agreedTotalAmount ?? loc.purchasePrice ?? 0);
      const totalPaid = Number(agr?.totalPaidAmount ?? 0);
      const outstandingBalance = Math.max(0, purchasePrice - totalPaid);
      const landownerName = agr?.landowner?.fullName || loc.landownerName || 'Stool / Family Elder';

      return {
        id: agr?.id || loc.id,
        agreementId: agr?.id || null,
        locationId: loc.id,
        landLocation: { id: loc.id, name: loc.name, region: loc.region },
        landowner: {
          id: agr?.landowner?.id || null,
          fullName: landownerName,
          telephone: agr?.landowner?.telephone || '',
        },
        agreementNumber: agr?.agreementNumber || `AGR-${loc.name.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
        agreedTotalAmount: purchasePrice,
        totalPaidAmount: totalPaid,
        outstandingBalance,
      };
    });
  }

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

    const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
    let count = (await this.prisma.landownerAgreement.count({
      where: { agreementNumber: { startsWith: `LOA-${dateCode}-` } },
    })) + 1;
    let agreementNumber = `LOA-${dateCode}-${String(count).padStart(4, '0')}`;
    while (await this.prisma.landownerAgreement.findUnique({ where: { agreementNumber } })) {
      count++;
      agreementNumber = `LOA-${dateCode}-${String(count).padStart(4, '0')}`;
    }

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
    const payoutAmount = Number(dto.amount ?? dto.amountPaid);
    if (!payoutAmount || payoutAmount <= 0) {
      throw new BadRequestException('Disbursement amount must be greater than zero.');
    }

    let agreement: any = null;
    if (dto.agreementId) {
      agreement = await this.prisma.landownerAgreement.findUnique({
        where: { id: dto.agreementId },
        include: {
          landowner: true,
          landLocation: true,
        },
      });
    }

    if (!agreement && dto.landLocationId) {
      agreement = await this.prisma.landownerAgreement.findFirst({
        where: { landLocationId: dto.landLocationId },
        include: {
          landowner: true,
          landLocation: true,
        },
      });
    }

    // Auto-create or resolve if not found
    if (!agreement) {
      const locId = dto.landLocationId || dto.agreementId;
      const location = locId
        ? await this.prisma.landLocation.findUnique({ where: { id: locId } })
        : null;

      if (!location) {
        throw new NotFoundException(`Landowner Agreement or Location with ID '${locId || 'unspecified'}' not found.`);
      }

      const loName = location.landownerName || 'Stool / Family Head';
      let landowner = await this.prisma.landowner.findFirst({
        where: { fullName: loName },
      });
      if (!landowner) {
        landowner = await this.prisma.landowner.create({
          data: {
            fullName: loName,
            telephone: '+233000000000',
            residentialAddress: location.geographicalAddress || location.name,
          },
        });
      }

      const agreedTotal = location.purchasePrice != null ? Number(location.purchasePrice) : payoutAmount;
      const count = await this.prisma.landownerAgreement.count();
      const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
      const agreementNumber = `LOA-${dateCode}-${String(count + 1).padStart(4, '0')}`;

      agreement = await this.prisma.landownerAgreement.create({
        data: {
          agreementNumber,
          landownerId: landowner.id,
          landLocationId: location.id,
          agreedTotalAmount: agreedTotal,
          totalPaidAmount: 0,
          outstandingBalance: agreedTotal,
          signedDate: new Date(),
        },
        include: { landowner: true, landLocation: true },
      });
    }

    const currentTotalAgreed = Number(agreement.agreedTotalAmount);
    const currentPaid = Number(agreement.totalPaidAmount);

    const newTotalPaid = currentPaid + payoutAmount;
    const newBalance = Math.max(0, currentTotalAgreed - newTotalPaid);

    // Generate unique Voucher Reference: VOU-YYYYMM-XXXX
    const today = new Date();
    const monthStr = today.toISOString().slice(0, 7).replace('-', '');
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    let countVou = (await this.prisma.landownerPayment.count({
      where: { voucherNumber: { startsWith: `VOU-${monthStr}-` } },
    })) + 1;
    let voucherNumber = `VOU-${monthStr}-${String(countVou).padStart(4, '0')}`;
    while (await this.prisma.landownerPayment.findUnique({ where: { voucherNumber } })) {
      countVou++;
      voucherNumber = `VOU-${monthStr}-${String(countVou).padStart(4, '0')}`;
    }

    // Fetch system settings for corporate branding
    const settings = await this.settingsService.getSettings(false);

    // Staff details
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { firstName: true, lastName: true },
    });
    const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Accounts Officer';

    const ref = dto.bankTransactionRef ?? dto.externalReference;
    const remarks = dto.remarks ?? dto.notes ?? (dto.bankName ? `Bank: ${dto.bankName}` : undefined);

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
        bankTransactionRef: ref,
        chequeNumber: dto.chequeNumber,
        remarks,
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
          bankTransactionRef: ref?.trim(),
          chequeNumber: dto.chequeNumber?.trim(),
          recordedByUserId: staffUser.id,
          pdfVoucherUrl,
          remarks: remarks?.trim(),
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
      let countExp = (await tx.expense.count({
        where: { expenseReference: { startsWith: `EXP-${dateStr}-` } },
      })) + 1;
      let expenseReference = `EXP-${dateStr}-${String(countExp).padStart(4, '0')}`;
      while (await tx.expense.findUnique({ where: { expenseReference } })) {
        countExp++;
        expenseReference = `EXP-${dateStr}-${String(countExp).padStart(4, '0')}`;
      }
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
      payment: {
        ...result.payment,
        agreement: {
          ...agreement,
          totalPaidAmount: newTotalPaid,
          outstandingBalance: result.newBalance,
        },
      },
      outstandingBalance: result.newBalance,
    };
  }

  /**
   * EDIT LANDOWNER PAYMENT:
   * Adjusts payment amount, channel, dates, and recalculates agreement balances and expense records.
   */
  async updateLandownerPayment(id: string, dto: UpdateLandownerPaymentDto, staffUser: { id: string; role: UserRole }) {
    const payment = await this.prisma.landownerPayment.findUnique({
      where: { id },
      include: {
        agreement: {
          include: { landowner: true, landLocation: true },
        },
        expenseRecord: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Landowner payment record with ID '${id}' not found.`);
    }

    const agreement = payment.agreement;
    const oldAmount = Number(payment.amount);
    const newAmount = dto.amount !== undefined ? Number(dto.amount) : dto.amountPaid !== undefined ? Number(dto.amountPaid) : oldAmount;
    const diff = newAmount - oldAmount;

    const currentTotalPaid = Number(agreement.totalPaidAmount);
    const agreedTotalAmount = Number(agreement.agreedTotalAmount);
    const updatedTotalPaid = currentTotalPaid + diff;
    const updatedBalance = Math.max(0, agreedTotalAmount - updatedTotalPaid);

    const ref = dto.bankTransactionRef ?? dto.externalReference;
    const notes = dto.remarks ?? dto.notes ?? (dto.bankName ? `Bank: ${dto.bankName}` : undefined);

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // 1. Update LandownerPayment
      const p = await tx.landownerPayment.update({
        where: { id },
        data: {
          amount: newAmount,
          paymentChannel: dto.paymentChannel || payment.paymentChannel,
          bankTransactionRef: ref !== undefined ? ref.trim() : payment.bankTransactionRef,
          chequeNumber: dto.chequeNumber !== undefined ? dto.chequeNumber.trim() : payment.chequeNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : payment.paymentDate,
          remarks: notes !== undefined ? notes.trim() : payment.remarks,
        },
      });

      // 2. Update Agreement Balance
      await tx.landownerAgreement.update({
        where: { id: agreement.id },
        data: {
          totalPaidAmount: updatedTotalPaid,
          outstandingBalance: updatedBalance,
        },
      });

      // 3. Update Expense record if linked
      if (payment.expenseRecord) {
        await tx.expense.update({
          where: { id: payment.expenseRecord.id },
          data: {
            amount: newAmount,
            paymentChannel: dto.paymentChannel || payment.paymentChannel,
            expenseDate: dto.paymentDate ? new Date(dto.paymentDate) : payment.paymentDate,
          },
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.UPDATE,
          entityName: 'LandownerPayment',
          entityId: payment.id,
          newValues: {
            voucherNumber: payment.voucherNumber,
            oldAmount,
            newAmount,
            updatedTotalPaid,
            updatedBalance,
          },
        },
      });

      return p;
    });

    return {
      message: `Landowner payment ${payment.voucherNumber} updated successfully.`,
      payment: {
        ...updatedPayment,
        agreement: {
          ...agreement,
          totalPaidAmount: updatedTotalPaid,
          outstandingBalance: updatedBalance,
        },
      },
      outstandingBalance: updatedBalance,
    };
  }

  async findOnePayment(id: string) {
    const payment = await this.prisma.landownerPayment.findUnique({
      where: { id },
      include: {
        agreement: {
          include: {
            landowner: true,
            landLocation: true,
          },
        },
        recordedByUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Landowner payment with ID '${id}' not found.`);
    }

    return payment;
  }

  async deleteObligation(locationId: string, staffUser: { id: string; role: UserRole }) {
    const location = await this.prisma.landLocation.findUnique({
      where: { id: locationId },
      include: {
        landownerAgreements: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Land Location with ID '${locationId}' not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Find all agreements for this land location
      const agreements = await tx.landownerAgreement.findMany({
        where: { landLocationId: locationId },
        include: { payments: true },
      });

      for (const agreement of agreements) {
        const paymentIds = agreement.payments.map((p) => p.id);
        if (paymentIds.length > 0) {
          await tx.expense.deleteMany({
            where: { landownerPaymentId: { in: paymentIds } },
          });
          await tx.landownerPayment.deleteMany({
            where: { id: { in: paymentIds } },
          });
        }
        await tx.landownerAgreement.delete({
          where: { id: agreement.id },
        });
      }

      // Also clean up any expenses directly tied to this land location under landowner payments
      await tx.expense.deleteMany({
        where: {
          landLocationId: locationId,
          categoryCode: ExpenseCategoryCode.LANDOWNER_PAYMENT,
        },
      });

      await tx.landLocation.update({
        where: { id: locationId },
        data: {
          purchasePrice: null,
          landownerName: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: AuditAction.DELETE_ATTEMPT,
          entityName: 'LandownerObligation',
          entityId: locationId,
          newValues: {
            locationName: location.name,
            action: 'DELETE_LANDOWNER_OBLIGATION',
          },
        },
      });
    });

    return {
      message: `Landowner obligation for ${location.name} deleted successfully.`,
    };
  }

  async deleteLandownerPayment(id: string, staffUser: { id: string; role: UserRole }) {
    const payment = await this.prisma.landownerPayment.findUnique({
      where: { id },
      include: {
        agreement: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Landowner Payment with ID '${id}' not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({
        where: { landownerPaymentId: id },
      });

      await tx.landownerPayment.delete({
        where: { id },
      });

      const remainingPayments = await tx.landownerPayment.findMany({
        where: { agreementId: payment.agreementId },
      });
      const newTotalPaid = remainingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const agreedTotal = Number(payment.agreement.agreedTotalAmount);
      const newBalance = Math.max(0, agreedTotal - newTotalPaid);

      await tx.landownerAgreement.update({
        where: { id: payment.agreementId },
        data: {
          totalPaidAmount: newTotalPaid,
          outstandingBalance: newBalance,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: AuditAction.DELETE_ATTEMPT,
          entityName: 'LandownerPayment',
          entityId: id,
          newValues: {
            voucherNumber: payment.voucherNumber,
            deletedAmount: Number(payment.amount),
            agreementId: payment.agreementId,
          },
        },
      });
    });

    return {
      message: `Landowner payout voucher ${payment.voucherNumber} deleted successfully.`,
    };
  }
}

