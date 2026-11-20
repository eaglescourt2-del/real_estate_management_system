import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddCustomerDocumentDto } from './dto/add-customer-document.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import {
  CustomerStatus,
  PhotoSource,
  UserRole,
  AuditAction,
  NotificationChannel,
  NotificationTriggerEvent,
  NotificationStatus,
  PlotStatus,
  PlotType,
  AllocationType,
  AllocationStatus,
  PaymentCategory,
  PaymentChannel,
  PaymentVerificationStatus,
  IncomeSourceCategory,
} from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {}

  /**
   * Formats Ghanaian telephone numbers into canonical E.164 +233XXXXXXXXX format
   */
  private formatGhanaPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('0')) {
      return `+233${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith('233')) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  async create(dto: CreateCustomerDto, staffUser: { id: string; role: UserRole }) {
    const canonicalPhone = this.formatGhanaPhone(dto.telephone);

    // Check duplicate phone
    const existingPhone = await this.prisma.customer.findUnique({
      where: { telephone: canonicalPhone },
    });

    if (existingPhone) {
      throw new ConflictException(
        `Customer with phone number '${canonicalPhone}' already exists (Customer Number: ${existingPhone.customerNumber}).`,
      );
    }

    // Determine assigned agent
    let assignedAgentId = staffUser.id;
    if (staffUser.role !== UserRole.SALES_AGENT && dto.assignedAgentId) {
      assignedAgentId = dto.assignedAgentId;
    }

    // Generate serialized Customer Number: CUST-YYYYMM-XXXX (guaranteed unique sequence)
    const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
    const lastCust = await this.prisma.customer.findFirst({
      where: { customerNumber: { startsWith: `CUST-${dateCode}-` } },
      orderBy: { customerNumber: 'desc' },
    });
    let nextCustSeq = 1;
    if (lastCust) {
      const parts = lastCust.customerNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextCustSeq = parsed + 1;
    }
    const customerNumber = `CUST-${dateCode}-${String(nextCustSeq).padStart(4, '0')}`;

    // Handle photograph capture or upload
    let photoData: { fileUrl: string; storageKey: string; sizeBytes: number; source: PhotoSource } | null = null;
    const base64Image = dto.photoBase64 || dto.cameraPhotoBase64;
    if (base64Image) {
      try {
        const saved = await this.uploadsService.saveBase64Image(base64Image, 'photos');
        photoData = {
          ...saved,
          source: dto.photoSource === PhotoSource.FILE_UPLOAD ? PhotoSource.FILE_UPLOAD : PhotoSource.CAMERA_CAPTURE,
        };
      } catch (photoErr: any) {
        this.logger.error(`Error saving customer photograph: ${photoErr?.message}`);
        // Graceful fallback if client provided a relative or remote URL
        if (base64Image.startsWith('/uploads/') || base64Image.startsWith('http://') || base64Image.startsWith('https://')) {
          photoData = {
            fileUrl: base64Image,
            storageKey: base64Image.replace('/uploads/', ''),
            sizeBytes: 0,
            source: dto.photoSource || PhotoSource.CAMERA_CAPTURE,
          };
        }
      }
    } else if (dto.photoUrl) {
      photoData = {
        fileUrl: dto.photoUrl,
        storageKey: dto.photoUrl.replace('/uploads/', ''),
        sizeBytes: 0,
        source: dto.photoSource || PhotoSource.FILE_UPLOAD,
      };
    }

    // Execute atomic customer creation
    const customer = await this.prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          customerNumber,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          otherNames: dto.otherNames?.trim(),
          telephone: canonicalPhone,
          altTelephone: dto.altTelephone ? this.formatGhanaPhone(dto.altTelephone) : null,
          email: dto.email?.toLowerCase().trim(),
          residentialAddress: dto.residentialAddress.trim(),
          gpsAddress: dto.gpsAddress?.trim(),
          occupation: dto.occupation?.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          idType: dto.idType,
          idNumber: dto.idNumber?.trim(),
          status: CustomerStatus.ACTIVE,
          assignedAgentId,
          createdById: staffUser.id,
        },
        include: {
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              telephone: true,
            },
          },
        },
      });

      // Save customer photograph if available
      if (photoData) {
        await tx.customerPhotograph.create({
          data: {
            customerId: newCustomer.id,
            fileUrl: photoData.fileUrl,
            storageKey: photoData.storageKey,
            source: photoData.source,
            fileSizeBytes: photoData.sizeBytes,
            isPrimary: true,
          },
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.CREATE,
          entityName: 'Customer',
          entityId: newCustomer.id,
          newValues: {
            customerNumber,
            name: `${newCustomer.firstName} ${newCustomer.lastName}`,
            telephone: canonicalPhone,
            photoSource: photoData?.source || 'NONE',
          },
        },
      });

      // Queue Welcome WhatsApp & Email Notification
      const idempotencyKey = `EVT-WELCOME-${newCustomer.id}-WHATSAPP`;
      await tx.notificationLog.create({
        data: {
          idempotencyKey,
          customerId: newCustomer.id,
          channel: NotificationChannel.WHATSAPP,
          event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
          recipientDestination: canonicalPhone,
          messageContent: `Welcome to our Real Estate Management System, ${newCustomer.firstName}. Your customer reference is ${newCustomer.customerNumber}.`,
          status: NotificationStatus.QUEUED,
        },
      });

      // Allocate plots if selected during customer registration
      if (dto.plotIds && dto.plotIds.length > 0) {
        // Pre-fetch all selected plots with their location to calculate exact plot-specific pricing
        const fetchedPlots = await Promise.all(
          dto.plotIds.map((plotId) =>
            tx.plot.findUnique({
              where: { id: plotId },
              include: {
                landLocation: true,
                childHalfPlots: true,
                parentPlot: { include: { childHalfPlots: true } },
              },
            }),
          ),
        );

        for (const plot of fetchedPlots) {
          if (!plot) {
            throw new NotFoundException(`One or more selected plots could not be found.`);
          }
          if (plot.status !== PlotStatus.AVAILABLE) {
            throw new ConflictException(`Plot '${plot.plotNumber}' is no longer available (current status: ${plot.status}).`);
          }
        }

        const planMonths = dto.paymentTerms === 'INSTALMENT' ? (dto.instalmentMonths || 3) : 1;
        const interestCycles = dto.paymentTerms === 'INSTALMENT' ? Math.max(0, Math.floor((planMonths - 3) / 3)) : 0;
        const allocStatus = dto.paymentTerms === 'INSTALMENT' ? AllocationStatus.ACTIVE_INSTALMENT : AllocationStatus.RESERVED;

        // Compute exact standard price per plot (Full vs Half) + proportional interest
        const plotPricing = fetchedPlots.map((p) => {
          const loc = p!.landLocation;
          const isHalf = p!.plotType === PlotType.HALF_PLOT;
          const basePrice = isHalf
            ? (Number(loc?.standardHalfPlotPrice) || 0)
            : (Number(loc?.standardFullPlotPrice) || 0);
          const interest = isHalf ? interestCycles * 500 : interestCycles * 1000;
          return { basePrice, interest, standardTotal: basePrice + interest };
        });

        const totalStandardSum = plotPricing.reduce((sum, item) => sum + item.standardTotal, 0);
        const totalAgreed = dto.totalAmount || totalStandardSum;
        const totalDeposit = dto.initialDeposit || 0;

        // Determine starting sequence for allocations and payments in current month
        const lastAlloc = await tx.plotAllocation.findFirst({
          where: { allocationNumber: { startsWith: `ALLOC-${dateCode}-` } },
          orderBy: { allocationNumber: 'desc' },
        });
        let nextAllocSeq = 1;
        if (lastAlloc) {
          const parts = lastAlloc.allocationNumber.split('-');
          const parsed = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(parsed)) nextAllocSeq = parsed + 1;
        }

        const lastPay = await tx.customerPayment.findFirst({
          where: { transactionReference: { startsWith: `PAY-${dateCode}-` } },
          orderBy: { transactionReference: 'desc' },
        });
        let nextPaySeq = 1;
        if (lastPay) {
          const parts = lastPay.transactionReference.split('-');
          const parsed = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(parsed)) nextPaySeq = parsed + 1;
        }

        for (let i = 0; i < fetchedPlots.length; i++) {
          const plot = fetchedPlots[i]!;
          const pricing = plotPricing[i]!;

          // Calculate exact agreed price for this plot proportionally if totalAmount was modified (e.g. discount)
          const ratio = totalStandardSum > 0 ? pricing.standardTotal / totalStandardSum : 1 / fetchedPlots.length;
          const agreedPricePerPlot = totalStandardSum > 0 && dto.totalAmount
            ? Math.round(totalAgreed * ratio * 100) / 100
            : pricing.standardTotal;

          const depositPerPlot = totalDeposit > 0
            ? Math.round(totalDeposit * ratio * 100) / 100
            : 0;

          // Enforce plot hierarchy transitions
          if (plot.plotType === PlotType.FULL_PLOT) {
            await tx.plot.update({
              where: { id: plot.id },
              data: { status: PlotStatus.SOLD, version: { increment: 1 } },
            });
            if (plot.childHalfPlots.length > 0) {
              await tx.plot.updateMany({
                where: { parentPlotId: plot.id },
                data: { status: PlotStatus.BLOCKED, version: { increment: 1 } },
              });
            }
          } else if (plot.plotType === PlotType.HALF_PLOT) {
            await tx.plot.update({
              where: { id: plot.id },
              data: { status: PlotStatus.SOLD, version: { increment: 1 } },
            });
            if (plot.parentPlot) {
              const sibling = plot.parentPlot.childHalfPlots.find((h) => h.id !== plot.id);
              const isSiblingSold = sibling ? sibling.status === PlotStatus.SOLD : false;
              await tx.plot.update({
                where: { id: plot.parentPlot.id },
                data: {
                  status: isSiblingSold ? PlotStatus.SOLD : PlotStatus.PARTIALLY_SOLD,
                  version: { increment: 1 },
                },
              });
            }
          }

          // Generate Guaranteed Unique Allocation Number
          const allocNumber = `ALLOC-${dateCode}-${String(nextAllocSeq + i).padStart(4, '0')}`;

          const allocation = await tx.plotAllocation.create({
            data: {
              allocationNumber: allocNumber,
              customerId: newCustomer.id,
              plotId: plot.id,
              salesAgentId: assignedAgentId,
              allocationType: plot.plotType === PlotType.HALF_PLOT ? AllocationType.HALF_PLOT : AllocationType.FULL_PLOT,
              agreedPrice: agreedPricePerPlot,
              depositRequired: depositPerPlot,
              totalAmountPaid: depositPerPlot,
              outstandingBalance: Math.max(0, agreedPricePerPlot - depositPerPlot),
              paymentPlanMonths: planMonths,
              status: allocStatus,
            },
          });

          // If initial deposit was paid, record CustomerPayment, Receipt, and corporate IncomeTransaction
          if (depositPerPlot > 0) {
            const txnRef = `PAY-${dateCode}-${String(nextPaySeq + i).padStart(4, '0')}`;
            const payment = await tx.customerPayment.create({
              data: {
                transactionReference: txnRef,
                allocationId: allocation.id,
                customerId: newCustomer.id,
                amount: depositPerPlot,
                currency: 'GHS',
                paymentCategory: PaymentCategory.INITIAL_DEPOSIT,
                paymentChannel: PaymentChannel.CASH,
                recordedByUserId: staffUser.id,
                status: PaymentVerificationStatus.VERIFIED,
                verifiedByUserId: staffUser.id,
                paymentDate: new Date(),
              },
            });

            // Serialized Receipt: RCT-YYYYMM-XXXX
            let countRct = (await tx.receipt.count({
              where: { receiptNumber: { startsWith: `RCT-${dateCode}-` } },
            })) + 1;
            let receiptNumber = `RCT-${dateCode}-${String(countRct).padStart(4, '0')}`;
            while (await tx.receipt.findUnique({ where: { receiptNumber } })) {
              countRct++;
              receiptNumber = `RCT-${dateCode}-${String(countRct).padStart(4, '0')}`;
            }

            await tx.receipt.create({
              data: {
                receiptNumber,
                paymentId: payment.id,
                allocationId: allocation.id,
                customerId: newCustomer.id,
                amountReceived: depositPerPlot,
                outstandingBalanceAfter: Math.max(0, agreedPricePerPlot - depositPerPlot),
                issuedDate: payment.paymentDate,
              },
            });

            // Serialized Corporate IncomeTransaction: INC-YYYYMMDD-XXXX
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            let countInc = (await tx.incomeTransaction.count({
              where: { transactionRef: { startsWith: `INC-${todayStr}-` } },
            })) + 1;
            let incRef = `INC-${todayStr}-${String(countInc).padStart(4, '0')}`;
            while (await tx.incomeTransaction.findUnique({ where: { transactionRef: incRef } })) {
              countInc++;
              incRef = `INC-${todayStr}-${String(countInc).padStart(4, '0')}`;
            }

            await tx.incomeTransaction.create({
              data: {
                transactionRef: incRef,
                customerPaymentId: payment.id,
                sourceCategory: IncomeSourceCategory.LAND_SALE_DEPOSIT,
                description: `Initial Deposit: Customer ${newCustomer.firstName} ${newCustomer.lastName} for ${plot.plotNumber} (${plot.landLocation.name})`,
                amount: depositPerPlot,
                currency: 'GHS',
                transactionDate: payment.paymentDate,
                paymentChannel: PaymentChannel.CASH,
              },
            });
          }
        }
      }

      return newCustomer;
    });

    // Fetch complete customer with allocations, plot details, photographs, and agent to return rich data immediately
    const richCustomer = await this.prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        photographs: {
          where: { isPrimary: true },
          take: 1,
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        allocations: {
          include: {
            plot: {
              include: {
                landLocation: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    let formattedCustomer: any = richCustomer;
    if (richCustomer) {
      const totalAgreed = richCustomer.allocations.reduce((sum, a) => sum + Number(a.agreedPrice), 0);
      const totalPaid = richCustomer.allocations.reduce((sum, a) => sum + Number(a.totalAmountPaid), 0);
      const totalBalance = richCustomer.allocations.reduce((sum, a) => sum + Number(a.outstandingBalance), 0);
      const locNames = Array.from(new Set(richCustomer.allocations.map((a) => a.plot?.landLocation?.name).filter(Boolean)));
      const plotNumbers = richCustomer.allocations.map((a) => a.plot?.plotNumber).filter(Boolean).join(', ');
      const paymentTerm = dto.paymentTerms || (dto as any).paymentTerm || (richCustomer.allocations.some((a) => a.paymentPlanMonths && a.paymentPlanMonths > 0) ? 'Instalment' : 'Outright');

      formattedCustomer = {
        ...richCustomer,
        fullName: `${richCustomer.firstName} ${richCustomer.lastName}${richCustomer.otherNames ? ' ' + richCustomer.otherNames : ''}`,
        primaryLocation: locNames[0] || 'Unassigned',
        allLocations: locNames.join(', ') || 'Unassigned',
        paymentTerm,
        plotNumbers,
        financials: {
          totalAgreedPrice: totalAgreed,
          totalAmountPaid: totalPaid,
          outstandingBalance: totalBalance,
        },
        allocationsCount: richCustomer.allocations.length,
      };
    }

    return {
      message: `Customer ${customer.firstName} ${customer.lastName} successfully registered.`,
      customer: formattedCustomer,
    };
  }

  async findAll(query: CustomerQueryDto, staffUser: { id: string; role: UserRole }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 25;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (query.assignedAgentId) {
      where.assignedAgentId = query.assignedAgentId;
    }

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: CustomerStatus.REFUNDED };
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { customerNumber: { contains: s, mode: 'insensitive' } },
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { otherNames: { contains: s, mode: 'insensitive' } },
        { telephone: { contains: s } },
        { idNumber: { contains: s, mode: 'insensitive' } },
        {
          allocations: {
            some: {
              plot: {
                landLocation: {
                  name: { contains: s, mode: 'insensitive' },
                },
              },
            },
          },
        },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          photographs: {
            where: { isPrimary: true },
            take: 1,
          },
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          allocations: {
            select: {
              id: true,
              plotId: true,
              agreedPrice: true,
              totalAmountPaid: true,
              outstandingBalance: true,
              status: true,
              paymentPlanMonths: true,
              allocationType: true,
              plot: {
                select: {
                  id: true,
                  plotNumber: true,
                  plotType: true,
                  halfPosition: true,
                  dimensions: true,
                  landLocation: {
                    select: {
                      id: true,
                      name: true,
                      region: true,
                      district: true,
                    },
                  },
                },
              },
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
            include: {
              receipt: true,
              allocation: {
                select: {
                  id: true,
                  agreedPrice: true,
                  totalAmountPaid: true,
                  outstandingBalance: true,
                  plot: {
                    select: {
                      plotNumber: true,
                      landLocation: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              payments: true,
              documents: true,
            },
          },
        },
      }),
    ]);

    // Format customers with financial ledger rollups and location/payment summaries
    const formatted = customers.map((c) => {
      const totalAgreed = c.allocations.reduce((sum, a) => sum + Number(a.agreedPrice), 0);
      const totalPaid = c.allocations.reduce((sum, a) => sum + Number(a.totalAmountPaid), 0);
      const totalBalance = c.allocations.reduce((sum, a) => sum + Number(a.outstandingBalance), 0);

      const primaryLocation = c.allocations[0]?.plot?.landLocation?.name || null;
      const allLocations = Array.from(
        new Set(c.allocations.map((a) => a.plot?.landLocation?.name).filter(Boolean)),
      ).join(', ');

      const paymentTerm = c.allocations.some((a) => a.paymentPlanMonths && a.paymentPlanMonths > 1)
        ? `Instalment (${c.allocations[0]?.paymentPlanMonths} Mos)`
        : c.allocations.length > 0
        ? 'Outright'
        : 'Outright';

      const plotNumbers = c.allocations.map((a) => a.plot?.plotNumber).filter(Boolean);

      return {
        id: c.id,
        customerNumber: c.customerNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        otherNames: c.otherNames,
        fullName: `${c.firstName} ${c.lastName}${c.otherNames ? ' ' + c.otherNames : ''}`,
        telephone: c.telephone,
        altTelephone: c.altTelephone,
        email: c.email,
        residentialAddress: c.residentialAddress,
        gpsAddress: c.gpsAddress,
        occupation: c.occupation,
        dateOfBirth: c.dateOfBirth,
        idType: c.idType,
        idNumber: c.idNumber,
        status: c.status,
        assignedAgent: c.assignedAgent,
        photographs: c.photographs,
        primaryPhotoUrl: c.photographs[0]?.fileUrl || null,
        primaryLocation,
        allLocations: allLocations || 'Unassigned',
        paymentTerm,
        plotNumbers,
        financials: {
          totalAgreedPrice: totalAgreed,
          totalAmountPaid: totalPaid,
          outstandingBalance: totalBalance,
        },
        allocationsCount: c.allocations.length,
        allocations: c.allocations,
        payments: c.payments,
        createdAt: c.createdAt,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, staffUser: { id: string; role: UserRole }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        photographs: {
          orderBy: { capturedAt: 'desc' },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            telephone: true,
          },
        },
        allocations: {
          include: {
            plot: {
              include: {
                landLocation: true,
              },
            },
            invoices: {
              orderBy: { issuedDate: 'desc' },
            },
            receipts: {
              orderBy: { issuedDate: 'desc' },
            },
          },
          orderBy: { allocatedAt: 'desc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            receipt: true,
          },
        },
        refundRequests: {
          include: {
            deductions: true,
            refundDisbursements: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        notifications: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer profile with ID '${id}' not found.`);
    }

    // Aggregate overall financial ledger
    const totalAgreed = customer.allocations.reduce((sum, a) => sum + Number(a.agreedPrice), 0);
    const totalPaid = customer.allocations.reduce((sum, a) => sum + Number(a.totalAmountPaid), 0);
    const totalBalance = customer.allocations.reduce((sum, a) => sum + Number(a.outstandingBalance), 0);

    return {
      customer,
      financialSummary: {
        totalAgreedPrice: totalAgreed,
        totalAmountPaid: totalPaid,
        outstandingBalance: totalBalance,
      },
    };
  }

  async update(id: string, dto: UpdateCustomerDto, staffUser: { id: string; role: UserRole }) {
    await this.findOne(id, staffUser); // Ensures customer exists and agent has access

    const { paymentTerms, instalmentMonths, totalAgreedPrice, ...customerFields } = dto;
    const updateData: any = { ...customerFields };
    if (dto.telephone) {
      updateData.telephone = this.formatGhanaPhone(dto.telephone);
    }
    if (dto.altTelephone) {
      updateData.altTelephone = this.formatGhanaPhone(dto.altTelephone);
    }
    if (dto.dateOfBirth) {
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    }

    // Only Admin and Super Admin can reassign sales agent
    if (dto.assignedAgentId && staffUser.role === UserRole.SALES_AGENT) {
      delete updateData.assignedAgentId;
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });

    // Handle instalment / pricing changes and reflect in payment calculations
    if (paymentTerms || instalmentMonths !== undefined || totalAgreedPrice !== undefined) {
      const allocations = await this.prisma.plotAllocation.findMany({
        where: { customerId: id },
        include: {
          plot: { include: { landLocation: true } },
          invoices: true,
        },
      });

      if (allocations.length > 0) {
        const isInstalment =
          (paymentTerms || '').toUpperCase() === 'INSTALMENT' ||
          (instalmentMonths !== undefined && instalmentMonths > 1);
        const planMonths = isInstalment ? (instalmentMonths || 3) : 1;
        const interestCycles = isInstalment ? Math.max(0, Math.floor((planMonths - 3) / 3)) : 0;

        // Compute standard price for each allocation
        const allocPricing = allocations.map((alloc) => {
          const loc = alloc.plot?.landLocation;
          const isHalf = alloc.plot?.plotType === PlotType.HALF_PLOT;
          const basePrice = isHalf
            ? (Number(loc?.standardHalfPlotPrice) || 0)
            : (Number(loc?.standardFullPlotPrice) || 0);
          const interest = isHalf ? interestCycles * 500 : interestCycles * 1000;
          return { basePrice, interest, standardTotal: basePrice + interest };
        });

        const totalStandardSum = allocPricing.reduce((sum, item) => sum + item.standardTotal, 0);
        const newTotalAgreed = totalAgreedPrice && totalAgreedPrice > 0 ? totalAgreedPrice : totalStandardSum;

        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i];
          const pricing = allocPricing[i];
          const ratio = totalStandardSum > 0 ? pricing.standardTotal / totalStandardSum : 1 / allocations.length;
          const newAgreedPrice = totalAgreedPrice && totalAgreedPrice > 0
            ? Math.round(newTotalAgreed * ratio * 100) / 100
            : pricing.standardTotal;

          const paid = Number(alloc.totalAmountPaid); // Payments made remain strictly untouched!
          const newOutstanding = Math.max(0, newAgreedPrice - paid);
          const newStatus =
            newOutstanding === 0
              ? AllocationStatus.PAID_IN_FULL
              : isInstalment
              ? AllocationStatus.ACTIVE_INSTALMENT
              : AllocationStatus.RESERVED;

          await this.prisma.plotAllocation.update({
            where: { id: alloc.id },
            data: {
              agreedPrice: newAgreedPrice,
              outstandingBalance: newOutstanding,
              paymentPlanMonths: planMonths,
              status: newStatus,
            },
          });

          // Update invoices balance
          if (alloc.invoices && alloc.invoices.length > 0) {
            for (const inv of alloc.invoices) {
              await this.prisma.invoice.update({
                where: { id: inv.id },
                data: {
                  subtotalAmount: newAgreedPrice,
                  totalAmountDue: newAgreedPrice,
                  balanceRemaining: newOutstanding,
                },
              });
            }
          }
        }

        // Record Audit Log for payment plan update
        await this.prisma.auditLog.create({
          data: {
            userId: staffUser.id,
            action: AuditAction.UPDATE,
            entityName: 'PlotAllocation',
            entityId: id,
            newValues: {
              action: 'CUSTOMER_PAYMENT_TERMS_UPDATED',
              paymentTerms: isInstalment ? 'INSTALMENT' : 'OUTRIGHT',
              paymentPlanMonths: planMonths,
              totalAgreedPrice: newTotalAgreed,
            },
          },
        });
      }
    }

    return {
      message: `Customer profile ${updated.customerNumber} updated successfully.`,
      customer: updated,
    };
  }

  async softDelete(id: string, staffUser: { id: string; role: UserRole }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        allocations: {
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
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark customer as soft-deleted
      const updated = await tx.customer.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // 2. Automatically return all allocated plots of this customer to AVAILABLE in their respective exact land locations
      for (const alloc of customer.allocations) {
        if (alloc.status !== AllocationStatus.CANCELLED) {
          await tx.plotAllocation.update({
            where: { id: alloc.id },
            data: { status: AllocationStatus.CANCELLED },
          });
        }

        if (alloc.plot) {
          const plot = alloc.plot;

          if (plot.plotType === PlotType.FULL_PLOT) {
            // Restore full plot to AVAILABLE
            await tx.plot.update({
              where: { id: plot.id },
              data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
            });

            // Restore any child half plots
            if (plot.childHalfPlots && plot.childHalfPlots.length > 0) {
              await tx.plot.updateMany({
                where: {
                  parentPlotId: plot.id,
                  status: { in: [PlotStatus.BLOCKED, PlotStatus.CANCELLED, PlotStatus.SOLD, PlotStatus.RESERVED] },
                },
                data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
              });
            }
          } else if (plot.plotType === PlotType.HALF_PLOT) {
            // Restore half plot to AVAILABLE
            await tx.plot.update({
              where: { id: plot.id },
              data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
            });

            // Check sibling half plot on parent full plot
            if (plot.parentPlot) {
              const siblingHalf = plot.parentPlot.childHalfPlots?.find((h) => h.id !== plot.id);
              if (!siblingHalf || siblingHalf.status === PlotStatus.AVAILABLE) {
                await tx.plot.update({
                  where: { id: plot.parentPlot.id },
                  data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
                });
              } else if (siblingHalf.status === PlotStatus.SOLD || siblingHalf.status === PlotStatus.RESERVED) {
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

          // Audit log for plot auto-restocked to available inventory in exact land location
          await tx.auditLog.create({
            data: {
              userId: staffUser.id,
              action: AuditAction.UPDATE,
              entityName: 'Plot',
              entityId: plot.id,
              newValues: {
                plotNumber: plot.plotNumber,
                landLocationId: plot.landLocationId,
                landLocationName: plot.landLocation?.name,
                status: PlotStatus.AVAILABLE,
                action: 'AUTO_RESTOCKED_TO_AVAILABLE_INVENTORY',
                reason: `Customer ${customer.customerNumber} (${customer.firstName} ${customer.lastName}) was deleted. Plot automatically added to the number of plots left in ${plot.landLocation?.name || 'land inventory'}.`,
              },
            },
          });
        }
      }

      // 3. Customer audit log
      await tx.auditLog.create({
        data: {
          userId: staffUser.id,
          action: AuditAction.DELETE_ATTEMPT,
          entityName: 'Customer',
          entityId: id,
          newValues: {
            isDeleted: true,
            deletedAt: new Date(),
            customerNumber: updated.customerNumber,
            plotsRestocked: customer.allocations.map((a) => a.plot?.plotNumber).filter(Boolean),
          },
        },
      });

      return updated;
    });

    return {
      message: `Customer ${result.customerNumber} (${result.firstName} ${result.lastName}) moved to trash. Allocated plot(s) automatically returned to available plots in inventory.`,
      customer: result,
    };
  }

  async restoreFromTrash(id: string, staffUser: { id: string; role: UserRole }) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: staffUser.id,
        action: AuditAction.UPDATE,
        entityName: 'Customer',
        entityId: id,
        newValues: {
          restoredFromTrash: true,
          customerNumber: updated.customerNumber,
        },
      },
    });

    return {
      message: `Customer ${updated.customerNumber} (${updated.firstName} ${updated.lastName}) restored from trash.`,
      customer: updated,
    };
  }

  async permanentDelete(id: string, staffUser: { id: string; role: UserRole }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        allocations: {
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
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.prisma.$transaction(async (tx) => {
      // 1. Reset all allocated plots of this customer back to AVAILABLE in their respective exact land locations
      for (const alloc of customer.allocations) {
        if (alloc.plot) {
          const plot = alloc.plot;

          if (plot.plotType === PlotType.FULL_PLOT) {
            await tx.plot.update({
              where: { id: plot.id },
              data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
            });
            if (plot.childHalfPlots && plot.childHalfPlots.length > 0) {
              await tx.plot.updateMany({
                where: {
                  parentPlotId: plot.id,
                  status: { in: [PlotStatus.BLOCKED, PlotStatus.CANCELLED, PlotStatus.SOLD, PlotStatus.RESERVED] },
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
              } else if (siblingHalf.status === PlotStatus.SOLD || siblingHalf.status === PlotStatus.RESERVED) {
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

          await tx.auditLog.create({
            data: {
              userId: staffUser.id,
              action: AuditAction.UPDATE,
              entityName: 'Plot',
              entityId: plot.id,
              newValues: {
                plotNumber: plot.plotNumber,
                landLocationId: plot.landLocationId,
                landLocationName: plot.landLocation?.name,
                status: PlotStatus.AVAILABLE,
                action: 'AUTO_RESTOCKED_TO_AVAILABLE_INVENTORY',
                reason: `Customer ${customer.customerNumber} (${customer.firstName} ${customer.lastName}) was permanently deleted. Plot automatically added to the number of plots left in ${plot.landLocation?.name || 'land inventory'}.`,
              },
            },
          });
        }
      }

      // 2. Cascade delete related records in proper foreign key dependency order
      // A. Refund Request dependencies (RefundRequest -> RefundPayment -> Expense)
      const refundRequests = await tx.refundRequest.findMany({
        where: { customerId: id },
        select: { id: true },
      });
      const refundRequestIds = refundRequests.map((r) => r.id);

      if (refundRequestIds.length > 0) {
        const refundPayments = await tx.refundPayment.findMany({
          where: { refundRequestId: { in: refundRequestIds } },
          select: { id: true },
        });
        const refundPaymentIds = refundPayments.map((p) => p.id);

        if (refundPaymentIds.length > 0) {
          // Delete expenses tied to refund payments
          await tx.expense.deleteMany({
            where: { refundPaymentId: { in: refundPaymentIds } },
          });
          // Delete refund payments
          await tx.refundPayment.deleteMany({
            where: { id: { in: refundPaymentIds } },
          });
        }

        // Delete refund deductions
        await tx.refundDeduction.deleteMany({
          where: { refundRequestId: { in: refundRequestIds } },
        });

        // Delete refund requests
        await tx.refundRequest.deleteMany({
          where: { id: { in: refundRequestIds } },
        });
      }

      // B. Customer Payments dependencies (CustomerPayment -> IncomeTransaction, Receipt)
      const customerPayments = await tx.customerPayment.findMany({
        where: { customerId: id },
        select: { id: true },
      });
      const customerPaymentIds = customerPayments.map((p) => p.id);

      if (customerPaymentIds.length > 0) {
        // Delete income transactions tied to customer payments
        await tx.incomeTransaction.deleteMany({
          where: { customerPaymentId: { in: customerPaymentIds } },
        });
      }

      // C. Receipts and Invoices
      await tx.receipt.deleteMany({ where: { customerId: id } });
      await tx.invoice.deleteMany({ where: { customerId: id } });

      // D. Customer Payments
      if (customerPaymentIds.length > 0) {
        await tx.customerPayment.deleteMany({
          where: { id: { in: customerPaymentIds } },
        });
      }

      // E. Plot Allocations
      await tx.plotAllocation.deleteMany({ where: { customerId: id } });

      // F. KYC Photos, Documents, Notifications
      await tx.customerPhotograph.deleteMany({ where: { customerId: id } });
      await tx.customerDocument.deleteMany({ where: { customerId: id } });
      await tx.notificationLog.deleteMany({ where: { customerId: id } });

      // G. Finally, permanently delete Customer record
      await tx.customer.delete({ where: { id } });
    });

    return {
      message: `Customer ${customer.customerNumber} (${customer.firstName} ${customer.lastName}) has been permanently deleted and their allocated plot(s) added back to plots left in inventory.`,
    };
  }

  async getTrash(staffUser: { id: string; role: UserRole }) {
    const where: any = { isDeleted: true };

    const trashedCustomers = await this.prisma.customer.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      include: {
        photographs: { where: { isPrimary: true }, take: 1 },
        assignedAgent: { select: { id: true, firstName: true, lastName: true } },
        allocations: {
          select: {
            id: true,
            plotId: true,
            agreedPrice: true,
            totalAmountPaid: true,
            outstandingBalance: true,
            plot: {
              select: {
                id: true,
                plotNumber: true,
                landLocation: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return trashedCustomers.map((c) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}${c.otherNames ? ' ' + c.otherNames : ''}`,
      primaryPhotoUrl: c.photographs[0]?.fileUrl || null,
      primaryLocation: c.allocations[0]?.plot?.landLocation?.name || 'Unassigned',
      plotNumbers: c.allocations.map((a) => a.plot?.plotNumber).filter(Boolean),
    }));
  }

  async addDocument(customerId: string, dto: AddCustomerDocumentDto, staffUser: { id: string; role: UserRole }) {
    await this.findOne(customerId, staffUser);

    const doc = await this.prisma.customerDocument.create({
      data: {
        customerId,
        documentTitle: dto.documentTitle.trim(),
        documentType: dto.documentType.trim(),
        fileUrl: dto.fileUrl,
        storageKey: dto.storageKey,
      },
    });

    return {
      message: `Document '${doc.documentTitle}' attached to customer profile.`,
      document: doc,
    };
  }

  async updatePhotograph(
    customerId: string,
    photoData: { base64?: string; fileUrl?: string; source: PhotoSource },
    staffUser: { id: string; role: UserRole },
  ) {
    await this.findOne(customerId, staffUser);

    let savedUrl = photoData.fileUrl;
    let storageKey = photoData.fileUrl ? photoData.fileUrl.replace('/uploads/', '') : '';
    let sizeBytes = 0;

    if (photoData.base64) {
      const saved = await this.uploadsService.saveBase64Image(photoData.base64, 'photos');
      savedUrl = saved.fileUrl;
      storageKey = saved.storageKey;
      sizeBytes = saved.sizeBytes;
    }

    // Set existing photos as non-primary
    await this.prisma.customerPhotograph.updateMany({
      where: { customerId },
      data: { isPrimary: false },
    });

    // Create new primary photo
    const photo = await this.prisma.customerPhotograph.create({
      data: {
        customerId,
        fileUrl: savedUrl!,
        storageKey,
        source: photoData.source,
        fileSizeBytes: sizeBytes,
        isPrimary: true,
      },
    });

    return {
      message: 'Customer photograph updated successfully.',
      photograph: photo,
    };
  }
}

