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
  PlotType,
  AllocationStatus,
  CustomerStatus,
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
  ) { }

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

    // Find active allocation for this customer and plot (supports plotId or allocationId)
    let allocation = null;
    if (dto.plotId) {
      allocation = await this.prisma.plotAllocation.findFirst({
        where: {
          customerId: dto.customerId,
          OR: [
            { plotId: dto.plotId },
            { id: dto.plotId },
          ],
          status: { in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT, AllocationStatus.PAID_IN_FULL] },
        },
        include: {
          plot: {
            include: { landLocation: true },
          },
        },
      });
    }

    // Fallback: If not found by specific plotId, locate any active allocation for this customer
    if (!allocation) {
      allocation = await this.prisma.plotAllocation.findFirst({
        where: {
          customerId: dto.customerId,
          status: { in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT, AllocationStatus.PAID_IN_FULL] },
        },
        include: {
          plot: {
            include: { landLocation: true },
          },
        },
      });
    }

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
    let countRef = (await this.prisma.refundRequest.count({
      where: { refundNumber: { startsWith: `REF-${dateCode}-` } },
    })) + 1;
    let refundNumber = `REF-${dateCode}-${String(countRef).padStart(4, '0')}`;
    while (await this.prisma.refundRequest.findUnique({ where: { refundNumber } })) {
      countRef++;
      refundNumber = `REF-${dateCode}-${String(countRef).padStart(4, '0')}`;
    }

    // Execute atomic refund registration and plot quarantine
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create RefundRequest
      const refund = await tx.refundRequest.create({
        data: {
          refundNumber,
          customerId: customer.id,
          plotId: allocation.plotId,
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
        where: { id: allocation.plotId },
        data: {
          status: PlotStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      // 4. Update customer status to REFUNDED (moving from Customer CRM to Refund Workflow)
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          status: CustomerStatus.REFUNDED,
        },
      });

      // 5. Record Audit Log
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

    return this.prisma.refundRequest.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            firstName: true,
            lastName: true,
            otherNames: true,
            telephone: true,
            email: true,
            residentialAddress: true,
          },
        },
        plot: {
          select: {
            id: true,
            plotNumber: true,
            dimensions: true,
            status: true,
            plotType: true,
            landLocation: { select: { id: true, name: true } },
          },
        },
        deductions: true,
        refundDisbursements: {
          orderBy: { disbursementDate: 'desc' },
        },
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

    const isApproved =
      dto.approved !== undefined
        ? Boolean(dto.approved)
        : dto.status === 'APPROVED' || (dto as any).decision === 'APPROVED';

    if (!isApproved) {
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
        plot: {
          include: {
            landLocation: true,
            childHalfPlots: true,
            parentPlot: {
              include: { childHalfPlots: true },
            },
          },
        },
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
    let countRfd = (await this.prisma.refundPayment.count({
      where: { refundDisbursementRef: { startsWith: `RFD-${monthStr}-` } },
    })) + 1;
    let refundDisbursementRef = `RFD-${monthStr}-${String(countRfd).padStart(4, '0')}`;
    while (await this.prisma.refundPayment.findUnique({ where: { refundDisbursementRef } })) {
      countRfd++;
      refundDisbursementRef = `RFD-${monthStr}-${String(countRfd).padStart(4, '0')}`;
    }

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

      // 2b. AUTOMATIC LAND RESTOCKING:
      // When refund is fully paid (100% disbursed), return the plot to AVAILABLE inventory so a new customer can buy it.
      if (newStatus === RefundStatus.FULLY_REFUNDED && refund.plot) {
        if (refund.plot.plotType === PlotType.FULL_PLOT) {
          await tx.plot.update({
            where: { id: refund.plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });

          // Unblock child half plots if present
          if (refund.plot.childHalfPlots && refund.plot.childHalfPlots.length > 0) {
            await tx.plot.updateMany({
              where: {
                parentPlotId: refund.plot.id,
                status: { in: [PlotStatus.BLOCKED, PlotStatus.CANCELLED] },
              },
              data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
            });
          }
        } else if (refund.plot.plotType === PlotType.HALF_PLOT) {
          await tx.plot.update({
            where: { id: refund.plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });

          // Check sibling half plot to see if parent full plot can also become AVAILABLE
          if (refund.plot.parentPlot) {
            const siblingHalf = refund.plot.parentPlot.childHalfPlots?.find(
              (h) => h.id !== refund.plot.id,
            );
            if (!siblingHalf || siblingHalf.status === PlotStatus.AVAILABLE) {
              await tx.plot.update({
                where: { id: refund.plot.parentPlot.id },
                data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
              });
            } else if (siblingHalf.status === PlotStatus.SOLD || siblingHalf.status === PlotStatus.RESERVED) {
              await tx.plot.update({
                where: { id: refund.plot.parentPlot.id },
                data: { status: PlotStatus.PARTIALLY_SOLD, version: { increment: 1 } },
              });
            }
          }
        } else {
          await tx.plot.update({
            where: { id: refund.plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });
        }

        // Record Audit Log for automatic plot restocking
        await tx.auditLog.create({
          data: {
            userId: staffUser.id,
            action: AuditAction.UPDATE,
            entityName: 'Plot',
            entityId: refund.plot.id,
            newValues: {
              plotNumber: refund.plot.plotNumber,
              action: 'AUTO_RESTOCKED_TO_AVAILABLE_INVENTORY',
              status: PlotStatus.AVAILABLE,
              reason: `Customer refund ${refund.refundNumber} fully settled (100% paid). Land parcel automatically restored to AVAILABLE inventory for new customer purchase.`,
            },
          },
        });
      }

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

  async deleteRefundRequest(id: string, staffUser: { id: string; role: UserRole }) {
    const refund = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: {
        plot: {
          include: {
            childHalfPlots: true,
            parentPlot: {
              include: { childHalfPlots: true },
            },
            landLocation: true,
          },
        },
        customer: true,
        refundDisbursements: true,
      },
    });

    if (!refund) {
      throw new NotFoundException(`Refund Request with ID '${id}' not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete corporate expenses tied to refund payments
      const allDisbursements = await tx.refundPayment.findMany({
        where: { refundRequestId: id },
        select: { id: true },
      });
      const disbursementIds = allDisbursements.map((d) => d.id);
      if (disbursementIds.length > 0) {
        await tx.expense.deleteMany({
          where: { refundPaymentId: { in: disbursementIds } },
        });
        await tx.refundPayment.deleteMany({
          where: { id: { in: disbursementIds } },
        });
      }

      // 2. Delete refund deductions
      await tx.refundDeduction.deleteMany({
        where: { refundRequestId: id },
      });

      // 3. Delete refund request
      await tx.refundRequest.delete({
        where: { id },
      });

      // 4. Restore physical plot back to AVAILABLE if it was quarantined/cancelled
      if (refund.plot && refund.plot.status !== PlotStatus.AVAILABLE && refund.plot.status !== PlotStatus.SOLD) {
        const plot = refund.plot;
        if (plot.plotType === PlotType.FULL_PLOT) {
          await tx.plot.update({
            where: { id: plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });
          if (plot.childHalfPlots && plot.childHalfPlots.length > 0) {
            await tx.plot.updateMany({
              where: {
                parentPlotId: plot.id,
                status: { in: [PlotStatus.BLOCKED, PlotStatus.CANCELLED] },
              },
              data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
            });
          }
        } else if (plot.plotType === PlotType.HALF_PLOT) {
          await tx.plot.update({
            where: { id: plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });
          if (plot.parentPlot) {
            const siblingHalf = plot.parentPlot.childHalfPlots?.find((h) => h.id !== plot.id);
            if (!siblingHalf || siblingHalf.status === PlotStatus.AVAILABLE) {
              await tx.plot.update({
                where: { id: plot.parentPlot.id },
                data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
              });
            } else if (siblingHalf.status === PlotStatus.SOLD) {
              await tx.plot.update({
                where: { id: plot.parentPlot.id },
                data: { status: PlotStatus.PARTIALLY_SOLD, version: { increment: 1 } },
              });
            }
          }
        } else {
          await tx.plot.update({
            where: { id: plot.id },
            data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
          });
        }
      }

      // 5. Restore customer status if customer has no other refunds
      const otherRefunds = await tx.refundRequest.count({
        where: { customerId: refund.customerId },
      });
      if (otherRefunds === 0 && refund.customer && refund.customer.status === CustomerStatus.REFUNDED) {
        await tx.customer.update({
          where: { id: refund.customerId },
          data: { status: CustomerStatus.ACTIVE },
        });
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser?.id || null,
          action: AuditAction.DELETE_ATTEMPT,
          entityName: 'RefundRequest',
          entityId: id,
          newValues: {
            refundNumber: refund.refundNumber,
            action: 'DELETE_REFUND_REQUEST',
            deletedAt: new Date(),
          },
        },
      });
    });

    return {
      message: `Refund request ${refund.refundNumber} deleted successfully and plot restocked to available inventory.`,
    };
  }
}

