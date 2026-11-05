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

    // Generate serialized Customer Number: CUST-YYYYMM-XXXX
    const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = await this.prisma.customer.count();
    const customerNumber = `CUST-${dateCode}-${String(count + 1).padStart(4, '0')}`;

    // Handle photograph capture or upload
    let photoData: { fileUrl: string; storageKey: string; sizeBytes: number; source: PhotoSource } | null = null;
    if (dto.cameraPhotoBase64) {
      const saved = await this.uploadsService.saveBase64Image(dto.cameraPhotoBase64, 'photos');
      photoData = {
        ...saved,
        source: PhotoSource.CAMERA_CAPTURE,
      };
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

      return newCustomer;
    });

    return {
      message: `Customer ${customer.firstName} ${customer.lastName} successfully registered.`,
      customer,
    };
  }

  async findAll(query: CustomerQueryDto, staffUser: { id: string; role: UserRole }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 25;
    const skip = (page - 1) * limit;

    const where: any = {};

    // SALES AGENT RESTRICTION: Agents can strictly access their assigned customers only!
    if (staffUser.role === UserRole.SALES_AGENT) {
      where.assignedAgentId = staffUser.id;
    } else if (query.assignedAgentId) {
      where.assignedAgentId = query.assignedAgentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { customerNumber: { contains: s, mode: 'insensitive' } },
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { telephone: { contains: s } },
        { idNumber: { contains: s, mode: 'insensitive' } },
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
              agreedPrice: true,
              totalAmountPaid: true,
              outstandingBalance: true,
              status: true,
              plot: {
                select: {
                  plotNumber: true,
                  landLocation: { select: { name: true } },
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

    // Format customers with financial ledger rollups
    const formatted = customers.map((c) => {
      const totalAgreed = c.allocations.reduce((sum, a) => sum + Number(a.agreedPrice), 0);
      const totalPaid = c.allocations.reduce((sum, a) => sum + Number(a.totalAmountPaid), 0);
      const totalBalance = c.allocations.reduce((sum, a) => sum + Number(a.outstandingBalance), 0);

      return {
        id: c.id,
        customerNumber: c.customerNumber,
        fullName: `${c.firstName} ${c.lastName}`,
        telephone: c.telephone,
        email: c.email,
        residentialAddress: c.residentialAddress,
        gpsAddress: c.gpsAddress,
        occupation: c.occupation,
        status: c.status,
        assignedAgent: c.assignedAgent,
        primaryPhotoUrl: c.photographs[0]?.fileUrl || null,
        financials: {
          totalAgreedPrice: totalAgreed,
          totalAmountPaid: totalPaid,
          outstandingBalance: totalBalance,
        },
        allocationsCount: c.allocations.length,
        allocations: c.allocations,
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

    // Role boundary check: Sales Agent can only view their assigned customers!
    if (staffUser.role === UserRole.SALES_AGENT && customer.assignedAgentId !== staffUser.id) {
      throw new ForbiddenException('Access denied. You can only view profiles of customers assigned to you.');
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

    const updateData: any = { ...dto };
    if (dto.altTelephone) {
      updateData.altTelephone = this.formatGhanaPhone(dto.altTelephone);
    }

    // Only Admin and Super Admin can reassign sales agent
    if (dto.assignedAgentId && staffUser.role === UserRole.SALES_AGENT) {
      delete updateData.assignedAgentId;
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });

    return {
      message: `Customer profile ${updated.customerNumber} updated successfully.`,
      customer: updated,
    };
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

