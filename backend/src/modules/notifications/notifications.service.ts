import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationTriggerEvent,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from './channels/whatsapp.service';
import { EmailService } from './channels/email.service';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  DefaultTemplateDefinition,
} from './templates/template-registry';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationTemplateDto } from './dto/whatsapp-webhook.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Seed default notification templates on module start
   */
  async onModuleInit() {
    this.logger.log('Initializing notification templates...');
    try {
      for (const tpl of DEFAULT_NOTIFICATION_TEMPLATES) {
        await this.prisma.notificationTemplate.upsert({
          where: {
            channel_event: {
              channel: tpl.channel,
              event: tpl.event,
            },
          },
          update: {},
          create: {
            channel: tpl.channel,
            event: tpl.event,
            name: tpl.name,
            templateIdentifier: tpl.templateIdentifier,
            bodyTemplate: tpl.bodyTemplate.trim(),
            isActive: true,
          },
        });
      }
      this.logger.log('Notification templates successfully initialized.');
    } catch (err: any) {
      this.logger.error(`Error initializing notification templates: ${err.message}`);
    }
  }

  /**
   * Compile template body by injecting variables
   */
  private compileTemplate(templateStr: string, variables: Record<string, any>): string {
    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : '';
    });
  }

  /**
   * Helper to retrieve system settings branding defaults
   */
  private async getSystemSettings() {
    const settings = await this.prisma.systemSetting.findUnique({
      where: { id: 'SYSTEM_CONFIG' },
    });
    return {
      companyName: settings?.companyName || 'Ghana Real Estate Developers',
      companyPhone: settings?.companyPhone || '+233 30 200 0000',
      companyEmail: settings?.companyEmail || 'info@realestatedev.gh',
      currency: settings?.currencySymbol || 'GH₵',
    };
  }

  /**
   * Dispatches a notification with strict idempotency and audit logging
   */
  async sendNotification(dto: CreateNotificationDto) {
    // 1. Check idempotency
    const existingLog = await this.prisma.notificationLog.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (
      existingLog &&
      (existingLog.status === NotificationStatus.SENT ||
        existingLog.status === NotificationStatus.DELIVERED ||
        existingLog.status === NotificationStatus.READ)
    ) {
      this.logger.warn(
        `Idempotent hit: Notification ${dto.idempotencyKey} already dispatched (status: ${existingLog.status}). Skipping duplicate.`,
      );
      return existingLog;
    }

    // 2. Fetch Customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    // 3. Resolve destination
    let destination = dto.recipientDestination;
    if (!destination) {
      if (dto.channel === NotificationChannel.WHATSAPP) {
        destination = customer.telephone;
      } else {
        destination = customer.email || undefined;
      }
    }

    if (!destination) {
      const errMsg = `Customer has no valid ${dto.channel} destination address`;
      this.logger.warn(`Failed notification for ${customer.customerNumber}: ${errMsg}`);
      return this.prisma.notificationLog.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        update: {
          status: NotificationStatus.FAILED,
          failureReason: errMsg,
        },
        create: {
          idempotencyKey: dto.idempotencyKey,
          customerId: customer.id,
          channel: dto.channel,
          event: dto.event,
          recipientDestination: 'N/A',
          messageContent: 'Destination missing',
          status: NotificationStatus.FAILED,
          failureReason: errMsg,
        },
      });
    }

    // 4. Resolve Template & Variables
    const branding = await this.getSystemSettings();
    const mergedVariables: Record<string, any> = {
      ...branding,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerNumber: customer.customerNumber,
      telephone: customer.telephone,
      email: customer.email || '',
      ...(dto.templateVariables || {}),
    };

    let compiledContent = dto.customMessage;

    if (!compiledContent) {
      const dbTemplate = await this.prisma.notificationTemplate.findUnique({
        where: {
          channel_event: {
            channel: dto.channel,
            event: dto.event,
          },
        },
      });

      let rawTemplate = dbTemplate?.bodyTemplate;
      if (!rawTemplate) {
        const defaultDef = DEFAULT_NOTIFICATION_TEMPLATES.find(
          (t) => t.channel === dto.channel && t.event === dto.event,
        );
        rawTemplate = defaultDef?.bodyTemplate || '{{companyName}} Notification';
      }

      compiledContent = this.compileTemplate(rawTemplate, mergedVariables);
    }

    // 5. Create or update NotificationLog record to QUEUED
    let logRecord = await this.prisma.notificationLog.upsert({
      where: { idempotencyKey: dto.idempotencyKey },
      update: {
        recipientDestination: destination,
        messageContent: compiledContent,
        status: NotificationStatus.QUEUED,
      },
      create: {
        idempotencyKey: dto.idempotencyKey,
        customerId: customer.id,
        channel: dto.channel,
        event: dto.event,
        recipientDestination: destination,
        messageContent: compiledContent,
        status: NotificationStatus.QUEUED,
      },
    });

    // 6. Execute Channel Transmission
    let sendResult: { success: boolean; externalMessageId?: string; failureReason?: string };

    if (dto.channel === NotificationChannel.WHATSAPP) {
      sendResult = await this.whatsappService.sendMessage(destination, compiledContent);
    } else {
      const subject = `${branding.companyName} - ${dto.event.replace(/_/g, ' ')}`;
      const wrappedHtml = this.emailService.wrapInBrandedTemplate(
        subject,
        compiledContent,
        branding.companyName,
      );
      sendResult = await this.emailService.sendEmail({
        to: destination,
        subject,
        htmlContent: wrappedHtml,
        fromName: branding.companyName,
      });
    }

    // 7. Update status according to result
    logRecord = await this.prisma.notificationLog.update({
      where: { id: logRecord.id },
      data: {
        status: sendResult.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        externalMessageId: sendResult.externalMessageId || null,
        failureReason: sendResult.failureReason || null,
        sentAt: sendResult.success ? new Date() : null,
      },
    });

    return logRecord;
  }

  /**
   * Retry a failed notification manually
   */
  async retryNotification(id: string) {
    const log = await this.prisma.notificationLog.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!log) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    if (log.status === NotificationStatus.DELIVERED || log.status === NotificationStatus.READ) {
      throw new BadRequestException('Notification has already been delivered or read.');
    }

    let sendResult: { success: boolean; externalMessageId?: string; failureReason?: string };

    if (log.channel === NotificationChannel.WHATSAPP) {
      sendResult = await this.whatsappService.sendMessage(
        log.recipientDestination,
        log.messageContent,
      );
    } else {
      const branding = await this.getSystemSettings();
      const subject = `${branding.companyName} - Notice Retry (${log.event.replace(/_/g, ' ')})`;
      const wrappedHtml = this.emailService.wrapInBrandedTemplate(
        subject,
        log.messageContent,
        branding.companyName,
      );
      sendResult = await this.emailService.sendEmail({
        to: log.recipientDestination,
        subject,
        htmlContent: wrappedHtml,
        fromName: branding.companyName,
      });
    }

    return this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        retryCount: log.retryCount + 1,
        status: sendResult.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        externalMessageId: sendResult.externalMessageId || log.externalMessageId,
        failureReason: sendResult.failureReason || null,
        sentAt: sendResult.success ? new Date() : log.sentAt,
      },
    });
  }

  /**
   * Process incoming WhatsApp webhook status callbacks
   */
  async handleWhatsAppWebhookStatuses(payload: any) {
    const statuses = this.whatsappService.parseWebhookStatuses(payload);
    for (const item of statuses) {
      try {
        const existingLog = await this.prisma.notificationLog.findFirst({
          where: { externalMessageId: item.externalMessageId },
        });

        if (existingLog) {
          await this.prisma.notificationLog.update({
            where: { id: existingLog.id },
            data: {
              status: item.status as NotificationStatus,
              deliveredAt: item.status === 'DELIVERED' || item.status === 'READ' ? item.timestamp : existingLog.deliveredAt,
              failureReason: item.failureReason || existingLog.failureReason,
            },
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Failed updating status for message ${item.externalMessageId}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Process all pending QUEUED notifications (batch worker)
   */
  async processQueuedNotifications(batchSize = 25) {
    const queuedLogs = await this.prisma.notificationLog.findMany({
      where: { status: NotificationStatus.QUEUED },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (queuedLogs.length === 0) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    this.logger.log(`Processing ${queuedLogs.length} queued notifications...`);
    let successful = 0;
    let failed = 0;
    const branding = await this.getSystemSettings();

    for (const log of queuedLogs) {
      try {
        let sendResult: { success: boolean; externalMessageId?: string; failureReason?: string };

        if (log.channel === NotificationChannel.WHATSAPP) {
          sendResult = await this.whatsappService.sendMessage(
            log.recipientDestination,
            log.messageContent,
          );
        } else {
          const subject = `${branding.companyName} - Notice (${log.event.replace(/_/g, ' ')})`;
          const wrappedHtml = this.emailService.wrapInBrandedTemplate(
            subject,
            log.messageContent,
            branding.companyName,
          );
          sendResult = await this.emailService.sendEmail({
            to: log.recipientDestination,
            subject,
            htmlContent: wrappedHtml,
            fromName: branding.companyName,
          });
        }

        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: sendResult.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            externalMessageId: sendResult.externalMessageId || null,
            failureReason: sendResult.failureReason || null,
            sentAt: sendResult.success ? new Date() : null,
          },
        });

        if (sendResult.success) successful++;
        else failed++;
      } catch (err: any) {
        failed++;
        this.logger.error(`Error processing notification ${log.id}: ${err.message}`);
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationStatus.FAILED,
            failureReason: err.message,
          },
        });
      }
    }

    return { processed: queuedLogs.length, successful, failed };
  }

  /**
   * Query notification history logs
   */
  async queryNotifications(query: QueryNotificationsDto) {
    const where: Prisma.NotificationLogWhereInput = {};

    if (query.customerId) where.customerId = query.customerId;
    if (query.channel) where.channel = query.channel;
    if (query.event) where.event = query.event;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
              telephone: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      records,
    };
  }

  /**
   * Retrieve notification templates
   */
  async getTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ channel: 'asc' }, { event: 'asc' }],
    });
  }

  /**
   * Update notification template
   */
  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Notification template with ID ${id} not found`);
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        bodyTemplate: dto.bodyTemplate.trim(),
        isActive: dto.isActive !== undefined ? dto.isActive : template.isActive,
      },
    });
  }

  // =========================================================================
  // INTEGRATED DISPATCH TRIGGER HELPERS (Called on operational business events)
  // =========================================================================

  /**
   * Trigger on Customer Registration (Dispatches WhatsApp and Email if email present)
   */
  async triggerCustomerRegistration(customer: any, assignedAgent?: any) {
    const idempotencyBase = `CUST-REG-${customer.id}`;

    // WhatsApp
    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: {
        agentName: assignedAgent ? `${assignedAgent.firstName} ${assignedAgent.lastName}` : 'Customer Support Desk',
        agentPhone: assignedAgent?.telephone || '+233 30 200 0000',
      },
    });

    // Email if provided
    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: {
          agentName: assignedAgent ? `${assignedAgent.firstName} ${assignedAgent.lastName}` : 'Customer Support Desk',
          agentPhone: assignedAgent?.telephone || '+233 30 200 0000',
        },
      });
    }
  }

  /**
   * Trigger on Plot Allocation Confirmation
   */
  async triggerPlotAllocation(allocation: any, customer: any, plot: any, location: any, agent?: any) {
    const idempotencyBase = `ALLOC-${allocation.id}`;
    const vars = {
      landLocation: location.name,
      plotNumber: plot.plotNumber,
      plotType: plot.isHalfPlot ? `Half Plot (${plot.halfPlotDesignation})` : 'Full Plot',
      agreedPrice: allocation.agreedPrice.toFixed(2),
      amountPaid: allocation.amountPaid.toFixed(2),
      outstandingBalance: allocation.outstandingBalance.toFixed(2),
      agentName: agent ? `${agent.firstName} ${agent.lastName}` : 'Sales Desk',
      agentPhone: agent?.telephone || '+233 30 200 0000',
    };

    // WhatsApp
    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.PLOT_ALLOCATION_CONFIRMATION,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    // Email
    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.PLOT_ALLOCATION_CONFIRMATION,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }

  /**
   * Trigger on Payment Received & Receipt Issued
   */
  async triggerPaymentReceipt(payment: any, receipt: any, customer: any, allocation?: any) {
    const idempotencyBase = `PMT-${payment.id}`;
    const vars = {
      receiptNumber: receipt.receiptNumber,
      amountPaid: payment.amountPaid.toFixed(2),
      paymentMethod: payment.paymentMethod.replace(/_/g, ' '),
      paymentReference: payment.externalReference || payment.paymentReference,
      plotNumber: allocation?.plot?.plotNumber || 'Unassigned Plot',
      landLocation: allocation?.plot?.landLocation?.name || 'Assigned Location',
      outstandingBalance: allocation?.outstandingBalance
        ? allocation.outstandingBalance.toFixed(2)
        : '0.00',
      paymentDate: new Date(payment.paymentDate).toLocaleDateString('en-GB'),
    };

    // WhatsApp
    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.PAYMENT_RECEIVED,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    // Email
    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.PAYMENT_RECEIVED,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }

  /**
   * Trigger on Invoice Generated
   */
  async triggerInvoiceGenerated(invoice: any, customer: any, allocation?: any) {
    const idempotencyBase = `INV-${invoice.id}`;
    const vars = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: invoice.totalAmount.toFixed(2),
      dueDate: new Date(invoice.dueDate).toLocaleDateString('en-GB'),
      plotNumber: allocation?.plot?.plotNumber || 'Land Plot',
      landLocation: allocation?.plot?.landLocation?.name || 'Selected Location',
    };

    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.INVOICE_GENERATED,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.INVOICE_GENERATED,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }

  /**
   * Trigger on Installment Due Reminder
   */
  async triggerPaymentReminder(
    allocation: any,
    customer: any,
    dueAmount: number,
    dueDate: string,
  ) {
    const idempotencyBase = `REMIND-${allocation.id}-${dueDate}`;
    const vars = {
      dueAmount: dueAmount.toFixed(2),
      dueDate,
      plotNumber: allocation?.plot?.plotNumber || 'Your Plot',
      landLocation: allocation?.plot?.landLocation?.name || 'Site',
      outstandingBalance: allocation.outstandingBalance.toFixed(2),
    };

    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.PAYMENT_REMINDER_DUE,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.PAYMENT_REMINDER_DUE,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }

  /**
   * Trigger on Refund Request Approval Decision (Approved or Rejected by MD)
   */
  async triggerRefundStatus(refund: any, customer: any) {
    const idempotencyBase = `REF-DECISION-${refund.id}-${refund.approvalStatus}`;
    const vars = {
      refundNumber: refund.refundNumber,
      approvalStatus: refund.approvalStatus,
      totalPaid: refund.totalAmountPaid.toFixed(2),
      deductionsAmount: refund.deductionsAmount.toFixed(2),
      netRefundAmount: refund.netRefundAmount.toFixed(2),
      reviewNotes: refund.rejectionReason || 'Approved for disbursement upon queue processing.',
    };

    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.REFUND_APPROVAL_STATUS,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.REFUND_APPROVAL_STATUS,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }

  /**
   * Trigger on Refund Payment Disbursed
   */
  async triggerRefundDisbursed(refund: any, disbursement: any, customer: any) {
    const idempotencyBase = `REF-DISB-${disbursement.id}`;
    const vars = {
      disbursedAmount: disbursement.amountPaid.toFixed(2),
      disbursementChannel: disbursement.paymentMethod.replace(/_/g, ' '),
      disbursementReference: disbursement.externalReference || disbursement.voucherNumber,
      transactionNumber: disbursement.voucherNumber,
      disbursementDate: new Date(disbursement.paymentDate).toLocaleDateString('en-GB'),
    };

    await this.sendNotification({
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      event: NotificationTriggerEvent.REFUND_PAYMENT_DISBURSED,
      idempotencyKey: `${idempotencyBase}-WA`,
      templateVariables: vars,
    });

    if (customer.email) {
      await this.sendNotification({
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.REFUND_PAYMENT_DISBURSED,
        idempotencyKey: `${idempotencyBase}-EM`,
        templateVariables: vars,
      });
    }
  }
}
