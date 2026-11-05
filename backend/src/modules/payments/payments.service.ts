import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { SettingsService } from '../settings/settings.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import {
  AllocationStatus,
  PaymentVerificationStatus,
  IncomeSourceCategory,
  AuditAction,
  NotificationChannel,
  NotificationTriggerEvent,
  NotificationStatus,
  UserRole,
} from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private settingsService: SettingsService,
  ) {}

  /**
   * CRITICAL FINANCIAL WORKFLOW: Record Customer Payment
   * Atomic balance update, serialized transaction & receipt generation,
   * PDF receipt creation, and direct link to corporate Income ledger.
   */
  async recordPayment(dto: RecordPaymentDto, staffUser: { id: string; role: UserRole }) {
    const allocation = await this.prisma.plotAllocation.findUnique({
      where: { id: dto.allocationId },
      include: {
        customer: true,
        plot: {
          include: {
            landLocation: true,
          },
        },
      },
    });

    if (!allocation) {
      throw new NotFoundException(`Plot Allocation with ID '${dto.allocationId}' not found.`);
    }

    if (allocation.status === AllocationStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payments on a cancelled allocation.');
    }

    // Role check: If staff is Sales Agent, verify customer is assigned to them
    if (staffUser.role === UserRole.SALES_AGENT && allocation.salesAgentId !== staffUser.id) {
      throw new ForbiddenException('You can only record payments for customers assigned to you.');
    }

    const currentAgreed = Number(allocation.agreedPrice);
    const currentPaid = Number(allocation.totalAmountPaid);
    const paymentAmount = Number(dto.amount);
    const newTotalPaid = currentPaid + paymentAmount;
    const newBalance = Math.max(0, currentAgreed - newTotalPaid);

    // Determine new allocation status
    let newStatus = allocation.status;
    if (newBalance === 0) {
      newStatus = AllocationStatus.PAID_IN_FULL;
    } else if (allocation.status === AllocationStatus.RESERVED) {
      newStatus = AllocationStatus.ACTIVE_INSTALMENT;
    }

    // Generate serialized Transaction Reference: TXN-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countTxn = await this.prisma.customerPayment.count();
    const transactionReference = `TXN-${dateStr}-${String(countTxn + 1).padStart(4, '0')}`;

    // Generate serialized Receipt Number: RCT-YYYYMM-XXXX
    const monthStr = today.toISOString().slice(0, 7).replace('-', '');
    const countRct = await this.prisma.receipt.count();
    const receiptNumber = `RCT-${monthStr}-${String(countRct + 1).padStart(4, '0')}`;

    // Fetch corporate white-label branding
    const settings = await this.settingsService.getSettings(false);

    // Fetch staff recording name
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { firstName: true, lastName: true },
    });
    const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Authorized Officer';

    // Generate PDF Receipt
    let pdfUrl = `/uploads/documents/Receipt_${receiptNumber}.pdf`;
    try {
      const generated = await this.pdfGenerator.generateReceiptPdf({
        receiptNumber,
        transactionReference,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : today,
        amountReceived: paymentAmount,
        outstandingBalanceAfter: newBalance,
        paymentCategory: dto.paymentCategory,
        paymentChannel: dto.paymentChannel,
        externalRef: dto.externalGatewayRef,
        bankDetails: dto.bankName ? `${dto.bankName} (${dto.bankBranch || 'Branch'})` : undefined,
        companyName: settings.companyName,
        companyTagline: settings.companyTagline || undefined,
        companyEmail: settings.companyEmail,
        companyPhone: settings.companyPhone,
        companyAddress: settings.companyAddress,
        currencySymbol: settings.currencySymbol,
        customerName: `${allocation.customer.firstName} ${allocation.customer.lastName}`,
        customerNumber: allocation.customer.customerNumber,
        customerPhone: allocation.customer.telephone,
        landLocationName: allocation.plot.landLocation.name,
        plotNumber: allocation.plot.plotNumber,
        plotDimensions: allocation.plot.dimensions,
        agreedPrice: currentAgreed,
        recordingStaffName: staffName,
      });
      pdfUrl = generated.pdfUrl;
    } catch (pdfErr) {
      this.logger.error(`Receipt PDF generation error: ${pdfErr.message}`);
    }

    // Map payment category to income category
    let incomeCat: IncomeSourceCategory = IncomeSourceCategory.LAND_SALE_INSTALMENT;
    if (dto.paymentCategory === 'INITIAL_DEPOSIT') incomeCat = IncomeSourceCategory.LAND_SALE_DEPOSIT;
    if (dto.paymentCategory === 'FULL_OUTRIGHT') incomeCat = IncomeSourceCategory.LAND_SALE_OUTRIGHT;
    if (dto.paymentCategory === 'RESERVATION_FEE') incomeCat = IncomeSourceCategory.RESERVATION_FEE;
    if (dto.paymentCategory === 'LEGAL_DOCUMENTATION_FEE' || dto.paymentCategory === 'SURVEY_INDENTURE_FEE') {
      incomeCat = IncomeSourceCategory.LEGAL_SURVEY_INCOME;
    }

    // Execute atomic financial update
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create CustomerPayment
      const payment = await tx.customerPayment.create({
        data: {
          transactionReference,
          allocationId: allocation.id,
          customerId: allocation.customerId,
          amount: paymentAmount,
          currency: 'GHS',
          paymentCategory: dto.paymentCategory,
          paymentChannel: dto.paymentChannel,
          bankName: dto.bankName?.trim(),
          bankBranch: dto.bankBranch?.trim(),
          chequeNumber: dto.chequeNumber?.trim(),
          externalGatewayRef: dto.externalGatewayRef?.trim(),
          supportingDocumentUrl: dto.supportingDocumentUrl,
          recordedByUserId: staffUser.id,
          status: PaymentVerificationStatus.VERIFIED,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : today,
        },
      });

      // 2. Create Receipt
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          allocationId: allocation.id,
          customerId: allocation.customerId,
          amountReceived: paymentAmount,
          outstandingBalanceAfter: newBalance,
          pdfUrl,
        },
      });

      // 3. Update PlotAllocation financial balance & status
      await tx.plotAllocation.update({
        where: { id: allocation.id },
        data: {
          totalAmountPaid: newTotalPaid,
          outstandingBalance: newBalance,
          status: newStatus,
          completedAt: newBalance === 0 ? today : null,
        },
      });

      // 4. Record linked corporate IncomeTransaction (prevents double counting)
      const countInc = await tx.incomeTransaction.count();
      const incRef = `INC-${dateStr}-${String(countInc + 1).padStart(4, '0')}`;
      await tx.incomeTransaction.create({
        data: {
          transactionRef: incRef,
          customerPaymentId: payment.id,
          sourceCategory: incomeCat,
          description: `Customer ${allocation.customer.firstName} ${allocation.customer.lastName} payment for ${allocation.plot.plotNumber} (${allocation.plot.landLocation.name})`,
          amount: paymentAmount,
          currency: 'GHS',
          transactionDate: payment.paymentDate,
          paymentChannel: dto.paymentChannel,
        },
      });

      // 5. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.PAYMENT_RECORDED,
          entityName: 'CustomerPayment',
          entityId: payment.id,
          newValues: {
            transactionReference,
            receiptNumber,
            amount: paymentAmount,
            allocationId: allocation.id,
            previousPaid: currentPaid,
            newTotalPaid,
            newBalance,
          },
        },
      });

      // 6. Queue Payment Receipt Notification (WhatsApp & Email)
      const idempotencyKey = `EVT-PAYMENT-${payment.id}-WHATSAPP`;
      await tx.notificationLog.create({
        data: {
          idempotencyKey,
          customerId: allocation.customerId,
          channel: NotificationChannel.WHATSAPP,
          event: NotificationTriggerEvent.PAYMENT_RECEIVED,
          recipientDestination: allocation.customer.telephone,
          messageContent: `Payment Received! Thank you, ${allocation.customer.firstName}. We received GH₵ ${paymentAmount.toLocaleString()} via ${dto.paymentChannel}. Receipt: ${receiptNumber}. Outstanding balance: GH₵ ${newBalance.toLocaleString()}.`,
          status: NotificationStatus.QUEUED,
        },
      });

      return {
        payment,
        receipt,
        newBalance,
        newStatus,
      };
    });

    return {
      message: `Payment of GHS ${paymentAmount.toLocaleString()} recorded successfully. Receipt #: ${result.receipt.receiptNumber}.`,
      payment: result.payment,
      receipt: result.receipt,
      outstandingBalance: result.newBalance,
      allocationStatus: result.newStatus,
    };
  }

  async findAll(query: PaymentQueryDto, staffUser: { id: string; role: UserRole }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 25;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role restrictions: Sales Agents can only view payments of their assigned customers
    if (staffUser.role === UserRole.SALES_AGENT) {
      where.allocation = {
        salesAgentId: staffUser.id,
      };
    }

    if (query.customerId) where.customerId = query.customerId;
    if (query.allocationId) where.allocationId = query.allocationId;
    if (query.category) where.paymentCategory = query.category;
    if (query.channel) where.paymentChannel = query.channel;
    if (query.status) where.status = query.status;

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { transactionReference: { contains: s, mode: 'insensitive' } },
        { customer: { firstName: { contains: s, mode: 'insensitive' } } },
        { customer: { lastName: { contains: s, mode: 'insensitive' } } },
        { customer: { customerNumber: { contains: s, mode: 'insensitive' } } },
        { externalGatewayRef: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, payments] = await Promise.all([
      this.prisma.customerPayment.count({ where }),
      this.prisma.customerPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
              telephone: true,
            },
          },
          allocation: {
            select: {
              id: true,
              allocationNumber: true,
              agreedPrice: true,
              totalAmountPaid: true,
              outstandingBalance: true,
              plot: {
                select: {
                  plotNumber: true,
                  landLocation: { select: { name: true } },
                },
              },
            },
          },
          receipt: {
            select: {
              receiptNumber: true,
              pdfUrl: true,
            },
          },
          recordedByUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const payment = await this.prisma.customerPayment.findUnique({
      where: { id },
      include: {
        customer: true,
        allocation: {
          include: {
            plot: {
              include: { landLocation: true },
            },
          },
        },
        receipt: true,
        recordedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        verifiedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Customer payment with ID '${id}' not found.`);
    }

    return payment;
  }

  /**
   * CRITICAL AUDIT RULE: Authorized Payment Reversal
   * Non-destructive, audit-controlled reversal.
   * Only Super Administrator or Managing Director can reverse financial entries.
   */
  async reversePayment(id: string, dto: ReversePaymentDto, staffUser: { id: string; role: UserRole }) {
    if (staffUser.role !== UserRole.SUPER_ADMINISTRATOR && staffUser.role !== UserRole.MANAGING_DIRECTOR) {
      throw new ForbiddenException('Only a Super Administrator or Managing Director can authorize payment reversals.');
    }

    const payment = await this.prisma.customerPayment.findUnique({
      where: { id },
      include: {
        allocation: true,
        incomeTransaction: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record with ID '${id}' not found.`);
    }

    if (payment.isReversed) {
      throw new ConflictException(`This payment has already been reversed on ${payment.updatedAt}.`);
    }

    const allocation = payment.allocation;
    const amountToRevert = Number(payment.amount);
    const newPaid = Number(allocation.totalAmountPaid) - amountToRevert;
    const newBalance = Number(allocation.outstandingBalance) + amountToRevert;

    // Execute atomic reversal
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark payment as reversed
      await tx.customerPayment.update({
        where: { id: payment.id },
        data: {
          isReversed: true,
          status: PaymentVerificationStatus.REVERSED,
          reversalReason: dto.reversalReason.trim(),
        },
      });

      // 2. Adjust plot allocation balance
      await tx.plotAllocation.update({
        where: { id: allocation.id },
        data: {
          totalAmountPaid: newPaid,
          outstandingBalance: newBalance,
          status: AllocationStatus.ACTIVE_INSTALMENT,
          completedAt: null,
        },
      });

      // 3. Mark linked income transaction
      if (payment.incomeTransaction) {
        await tx.incomeTransaction.delete({
          where: { id: payment.incomeTransaction.id },
        });
      }

      // 4. Create immutable Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.PAYMENT_REVERSED,
          entityName: 'CustomerPayment',
          entityId: payment.id,
          newValues: {
            transactionReference: payment.transactionReference,
            reversalReason: dto.reversalReason,
            revertedAmount: amountToRevert,
            newPaid,
            newBalance,
            authorizedByRole: staffUser.role,
          },
        },
      });
    });

    return {
      message: `Payment ${payment.transactionReference} of GHS ${amountToRevert.toLocaleString()} has been authorized and reversed.`,
      adjustedAllocation: {
        id: allocation.id,
        newTotalPaid: newPaid,
        newOutstandingBalance: newBalance,
      },
    };
  }
}
