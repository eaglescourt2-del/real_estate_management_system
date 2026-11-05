import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { ApproveRefundRequestDto } from './dto/approve-refund-request.dto';
import { DisburseRefundPaymentDto } from './dto/disburse-refund-payment.dto';
import {
  RefundStatus,
  PlotStatus,
  AllocationStatus,
  ExpenseCategoryCode,
  ExpenseApprovalStatus,
  AuditAction,
  NotificationChannel,
  NotificationTriggerEvent,
  NotificationStatus,
  UserRole,
} from '@prisma/client';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private voucherPdf: VoucherPdfService,
    private settingsService: SettingsService,
  ) {}

  /**
   * CRITICAL REFUND REGISTRATION WORKFLOW:
   * Registers refund request, calculates proposed deductions (Net Refund = Total Paid - Deductions),
   * transitions plot allocation to CANCELLED, and quarantines physical plot status to CANCELLED.
   */
  async createRefundRequest(dto: CreateRefundRequestDto, staffUser: { id: string; role: UserRole }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException(`Customer with ID '${dto.customerId}' not found.`);

    // Find active allocation for this plot and customer
    const allocation = await this.prisma.plotAllocation.findFirst({
      where: {
        customerId: dto.customerId,
        plotId: dto.plotId,
        status: { in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT, AllocationStatus.PAID_IN_FULL] },
      },
      include: {
        plot: {
          include: { landLocation: true },
        },
      },
    });

    if (!allocation) {
      throw new BadRequestException('No active allocation found for this customer and plot.');
    }

    const totalPaid = Number(allocation.totalAmountPaid);
    if (totalPaid <= 0) {
      throw new BadRequestException('No payments have been received for this allocation to refund.');
    }

    // Calculate deductions
    const deductionsList = dto.deductions || [];
    const totalDeductions = deductionsList.reduce((sum, d) => sum + Number(d.amount), 0);

    if (totalDeductions > totalPaid) {
      throw new BadRequestException(
        `Total deductions (GHS ${totalDeductions.toLocaleString()}) cannot exceed total payments received (GHS ${totalPaid.toLocaleString()}).`,
      );
    }

    const netRefundAmount = totalPaid - totalDeductions;

    // Generate serialized Refund Reference: REF-YYYYMM-XXXX
    const today = new Date();
    const dateCode = today.toISOString().slice(0, 7).replace('-', '');
    const countRef = await this.prisma.refundRequest.count();
    const refundNumber = `REF-${dateCode}-${String(countRef + 1).padStart(4, '0')}`;

    // Execute atomic refund registration and plot quarantine
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create RefundRequest
      const refund = await tx.refundRequest.create({
        data: {
          refundNumber,
          customerId: customer.id,
          plotId: dto.plotId,
          totalPaymentsReceived: totalPaid,
          totalDeductions,
          netRefundAmount,
          totalRefundPaid: 0,
          remainingRefundDue: netRefundAmount,
          reason: dto.reason.trim(),
          status: RefundStatus.REQUESTED,
          requestedByUserId: staffUser.id,
          deductions: {
            create: deductionsList.map((d) => ({
              deductionName: d.deductionName.trim(),
              amount: Number(d.amount),
              explanation: d.explanation.trim(),
            })),
          },
        },
        include: {
          deductions: true,
        },
      });

      // 2. Mark allocation as CANCELLED
      await tx.plotAllocation.update({
        where: { id: allocation.id },
        data: {
          status: AllocationStatus.CANCELLED,
          cancelledAt: today,
          cancellationReason: `Refund Requested: ${dto.reason.trim()}`,
        },
      });

      // 3. QUARANTINE PHYSICAL PLOT: Status set to CANCELLED (cannot be resold automatically!)
      await tx.plot.update({
        where: { id: dto.plotId },
        data: {
          status: PlotStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      // 4. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.REFUND_REQUESTED,
          entityName: 'RefundRequest',
          entityId: refund.id,
          newValues: {
            refundNumber,
            customerName: `${customer.firstName} ${customer.lastName}`,
            plotNumber: allocation.plot.plotNumber,
            totalPaid,
            totalDeductions,
            netRefundAmount,
            status: RefundStatus.REQUESTED,
          },
        },
      });

      return refund;
    });

    return {
      message: `Refund request ${refundNumber} registered. Net refund payable: GHS ${netRefundAmount.toLocaleString()}. Plot quarantined.`,
      refund: result,
    };
  }

  async findAll(staffUser: { id: string; role: UserRole }, status?: RefundStatus) {
    const where: any = {};
    if (status) where.status = status;

    if (staffUser.role === UserRole.SALES_AGENT) {
      where.customer = { assignedAgentId: staffUser.id };
    }

    return this.prisma.refundRequest.findMany({
      where,
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
        plot: {
          select: {
            id: true,
            plotNumber: true,
            dimensions: true,
            landLocation: { select: { name: true } },
          },
        },
        deductions: true,
        refundDisbursements: true,
        requestedByUser: { select: { firstName: true, lastName: true } },
        approvedByUser: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const refund = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        plot: {
          include: { landLocation: true },
        },
        deductions: true,
        refundDisbursements: {
          orderBy: { disbursementDate: 'desc' },
        },
        requestedByUser: { select: { firstName: true, lastName: true, role: true } },
        approvedByUser: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    if (!refund) throw new NotFoundException(`Refund request with ID '${id}' not found.`);
    return refund;
  }

  /**
   * CRITICAL APPROVAL WORKFLOW:
   * Managing Director or Super Administrator approves or rejects the refund and deductions.
   * Generates official Customer Refund Statement PDF upon approval.
   */
  async approveRefund(id: string, dto: ApproveRefundRequestDto, staffUser: { id: string; role: UserRole }) {
    if (staffUser.role !== UserRole.SUPER_ADMINISTRATOR && staffUser.role !== UserRole.MANAGING_DIRECTOR) {
      throw new ForbiddenException('Only a Managing Director or Super Administrator can approve customer refunds.');
    }

    const refund = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        plot: { include: { landLocation: true } },
        deductions: true,
      },
    });

    if (!refund) throw new NotFoundException(`Refund request with ID '${id}' not found.`);

    if (refund.status !== RefundStatus.REQUESTED && refund.status !== RefundStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot alter refund with current status '${refund.status}'.`);
    }

    const today = new Date();
    const settings = await this.settingsService.getSettings(false);
    const approver = await this.prisma.user.findUnique({
      where: { id: staffUser.id },
      select: { firstName: true, lastName: true },
    });
    const approverName = approver ? `${approver.firstName} ${approver.lastName}` : 'Managing Director';

    if (!dto.approved) {
      // Rejection branch
      const rejected = await this.prisma.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.REJECTED,
          rejectionReason: dto.rejectionReason || 'Rejected by Managing Director',
          approvedByUserId: staffUser.id,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.REFUND_REJECTED,
          entityName: 'RefundRequest',
          entityId: refund.id,
          newValues: { status: RefundStatus.REJECTED, reason: dto.rejectionReason },
        },
      });

      return {
        message: `Refund request ${refund.refundNumber} has been rejected.`,
        refund: rejected,
      };
    }

    // Approval branch: Generate PDF Statement
    let statementPdfUrl = `/uploads/documents/Refund_Statement_${refund.refundNumber}.pdf`;
    try {
      const generated = await this.voucherPdf.generateRefundStatementPdf({
        refundNumber: refund.refundNumber,
        customerName: `${refund.customer.firstName} ${refund.customer.lastName}`,
        customerNumber: refund.customer.customerNumber,
        customerPhone: refund.customer.telephone,
        plotNumber: refund.plot.plotNumber,
        landLocationName: refund.plot.landLocation.name,
        requestDate: refund.createdAt,
        totalPaymentsReceived: Number(refund.totalPaymentsReceived),
        totalDeductions: Number(refund.totalDeductions),
        netRefundAmount: Number(refund.netRefundAmount),
        totalRefundPaid: 0,
        remainingRefundDue: Number(refund.netRefundAmount),
        reason: refund.reason,
        deductions: refund.deductions.map((d) => ({
          deductionName: d.deductionName,
          amount: Number(d.amount),
          explanation: d.explanation,
        })),
        companyName: settings.companyName,
        companyEmail: settings.companyEmail,
        companyPhone: settings.companyPhone,
        companyAddress: settings.companyAddress,
        currencySymbol: settings.currencySymbol,
        approvedByName: approverName,
      });
      statementPdfUrl = generated.pdfUrl;
    } catch (pdfErr) {
      this.logger.error(`Error generating refund statement PDF: ${pdfErr.message}`);
    }

    const approvedRefund = await this.prisma.refundRequest.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.APPROVED,
        approvedByUserId: staffUser.id,
        approvalDate: today,
        statementPdfUrl,
      },
    });

    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId: staffUser.id,
        action: AuditAction.REFUND_APPROVED,
        entityName: 'RefundRequest',
        entityId: refund.id,
        newValues: {
          status: RefundStatus.APPROVED,
          netRefundAmount: refund.netRefundAmount,
          approvedBy: approverName,
        },
      },
    });

    // Queue WhatsApp notification to customer
    const idempotencyKey = `EVT-REFUND-APPROVED-${refund.id}-WHATSAPP`;
    await this.prisma.notificationLog.create({
      data: {
        idempotencyKey,
        customerId: refund.customerId,
        channel: NotificationChannel.WHATSAPP,
        event: NotificationTriggerEvent.REFUND_APPROVAL_STATUS,
        recipientDestination: refund.customer.telephone,
        messageContent: `Your refund request (${refund.refundNumber}) for ${refund.plot.plotNumber} has been approved by management. Net approved refund: GH₵ ${Number(refund.netRefundAmount).toLocaleString()}. Payout will be disbursed per agreement.`,
        status: NotificationStatus.QUEUED,
      },
    });

    return {
      message: `Refund request ${refund.refundNumber} successfully approved by Managing Director. Statement generated.`,
      refund: approvedRefund,
    };
  }

  /**
   * CRITICAL DISBURSEMENT WORKFLOW:
   * Staff records external payment disbursed to customer (MoMo Transfer, Bank Transfer, Cash),
   * updates remaining refund balance, transitions status, and logs corporate Expense.
   */
  async disburseRefundPayment(refundId: string, dto: DisburseRefundPaymentDto, staffUser: { id: string; role: UserRole }) {
    const refund = await this.prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        customer: true,
        plot: { include: { landLocation: true } },
      },
    });

    if (!refund) throw new NotFoundException(`Refund request with ID '${refundId}' not found.`);

    if (refund.status !== RefundStatus.APPROVED && refund.status !== RefundStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException(
        `Refund cannot be disbursed. Current status is '${refund.status}'. It must be APPROVED first.`,
      );
    }

    const disburseAmount = Number(dto.amount);
    const remainingDue = Number(refund.remainingRefundDue);

    if (disburseAmount > remainingDue) {
      throw new BadRequestException(
        `Disbursement amount of GHS ${disburseAmount.toLocaleString()} exceeds remaining refund due of GHS ${remainingDue.toLocaleString()}.`,
      );
    }

    const currentPaid = Number(refund.totalRefundPaid);
    const newTotalRefundPaid = currentPaid + disburseAmount;
    const newRemainingDue = Math.max(0, remainingDue - disburseAmount);
    const newStatus = newRemainingDue === 0 ? RefundStatus.FULLY_REFUNDED : RefundStatus.PARTIALLY_REFUNDED;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const monthStr = today.toISOString().slice(0, 7).replace('-', '');
    const countRfd = await this.prisma.refundPayment.count();
    const refundDisbursementRef = `RFD-${monthStr}-${String(countRfd + 1).padStart(4, '0')}`;

    // Execute atomic disbursement and expense logging
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create RefundPayment disbursement record
      const disbursement = await tx.refundPayment.create({
        data: {
          refundDisbursementRef,
          refundRequestId: refund.id,
          amount: disburseAmount,
          disbursementDate: dto.disbursementDate ? new Date(dto.disbursementDate) : today,
          paymentChannel: dto.paymentChannel,
          transactionReference: dto.transactionReference?.trim(),
          notes: dto.notes?.trim(),
        },
      });

      // 2. Update RefundRequest totals and status
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          totalRefundPaid: newTotalRefundPaid,
          remainingRefundDue: newRemainingDue,
          status: newStatus,
        },
      });

      // 3. Link directly to corporate Expense ledger (avoids double counting)
      const countExp = await tx.expense.count();
      const expenseReference = `EXP-${dateStr}-${String(countExp + 1).padStart(4, '0')}`;
      await tx.expense.create({
        data: {
          expenseReference,
          landLocationId: refund.plot.landLocationId,
          refundPaymentId: disbursement.id,
          categoryCode: ExpenseCategoryCode.CUSTOMER_REFUND_DISBURSEMENT,
          description: `Customer Refund payout to ${refund.customer.firstName} ${refund.customer.lastName} (${refund.refundNumber}) for ${refund.plot.plotNumber}`,
          amount: disburseAmount,
          currency: 'GHS',
          expenseDate: disbursement.disbursementDate,
          paymentChannel: dto.paymentChannel,
          recipient: `${refund.customer.firstName} ${refund.customer.lastName}`,
          recordedByUserId: staffUser.id,
          approvalStatus: ExpenseApprovalStatus.APPROVED,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.CREATE,
          entityName: 'RefundPayment',
          entityId: disbursement.id,
          newValues: {
            refundDisbursementRef,
            amount: disburseAmount,
            channel: dto.paymentChannel,
            newRemainingDue,
            status: newStatus,
          },
        },
      });

      // 5. Queue Notification
      const idempotencyKey = `EVT-REFUND-PAYMENT-${disbursement.id}-WHATSAPP`;
      await tx.notificationLog.create({
        data: {
          idempotencyKey,
          customerId: refund.customerId,
          channel: NotificationChannel.WHATSAPP,
          event: NotificationTriggerEvent.REFUND_PAYMENT_DISBURSED,
          recipientDestination: refund.customer.telephone,
          messageContent: `Refund Disbursed: We have paid GH₵ ${disburseAmount.toLocaleString()} via ${dto.paymentChannel} for refund ${refund.refundNumber}. Remaining refund due: GH₵ ${newRemainingDue.toLocaleString()}.`,
          status: NotificationStatus.QUEUED,
        },
      });

      return {
        disbursement,
        newRemainingDue,
        newStatus,
      };
    });

    return {
      message: `Refund payment of GHS ${disburseAmount.toLocaleString()} disbursed. Reference: ${refundDisbursementRef}. Remaining: GHS ${result.newRemainingDue.toLocaleString()}.`,
      disbursement: result.disbursement,
      refundStatus: result.newStatus,
      remainingRefundDue: result.newRemainingDue,
    };
  }
}

