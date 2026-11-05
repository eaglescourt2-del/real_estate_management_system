import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole, CustomerStatus, PhotoSource, IdType } from '@prisma/client';

describe('CustomersService (Stage 4 CRM Verification)', () => {
  let service: CustomersService;
  let prismaService: any;
  let uploadsService: any;

  const mockStaffAdmin = { id: 'admin-uuid-1', role: UserRole.ADMINISTRATOR };
  const mockStaffAgent1 = { id: 'agent-uuid-1', role: UserRole.SALES_AGENT };
  const mockStaffAgent2 = { id: 'agent-uuid-2', role: UserRole.SALES_AGENT };

  const mockCustomer = {
    id: 'cust-uuid-100',
    customerNumber: 'CUST-202611-0001',
    firstName: 'Kwame',
    lastName: 'Mensah',
    telephone: '+233244123456',
    email: 'k.mensah@gh.com',
    residentialAddress: 'East Legon, Accra',
    gpsAddress: 'GA-183-9020',
    status: CustomerStatus.ACTIVE,
    assignedAgentId: 'agent-uuid-1',
    allocations: [
      {
        id: 'alc-1',
        agreedPrice: 50000,
        totalAmountPaid: 20000,
        outstandingBalance: 30000,
        plot: { plotNumber: 'Plot 1', landLocation: { name: 'Prampram' } },
        invoices: [],
        receipts: [],
      },
    ],
    photographs: [],
    documents: [],
    payments: [],
    refundRequests: [],
    notifications: [],
  };

  beforeEach(async () => {
    prismaService = {
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      customerPhotograph: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      notificationLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    uploadsService = {
      saveBase64Image: jest.fn().mockResolvedValue({
        fileUrl: '/uploads/photos/test-snap.jpg',
        storageKey: 'photos/test-snap.jpg',
        sizeBytes: 150000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: UploadsService, useValue: uploadsService },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('should successfully register customer with camera photo and canonical Ghana phone number', async () => {
    prismaService.customer.findUnique.mockResolvedValue(null);
    prismaService.customer.create.mockResolvedValue({
      ...mockCustomer,
      telephone: '+233244123456',
      customerNumber: 'CUST-202611-0001',
    });

    const result = await service.create(
      {
        firstName: 'Kwame',
        lastName: 'Mensah',
        telephone: '0244123456', // Local format
        residentialAddress: 'East Legon, Accra',
        idType: IdType.GHANA_CARD,
        idNumber: 'GHA-719284019-2',
        cameraPhotoBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      },
      mockStaffAdmin,
    );

    expect(result.customer.telephone).toEqual('+233244123456');
    expect(uploadsService.saveBase64Image).toHaveBeenCalled();
    expect(prismaService.customerPhotograph.create).toHaveBeenCalled();
    expect(prismaService.notificationLog.create).toHaveBeenCalled();
  });

  it('should reject registration if telephone number already exists', async () => {
    prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

    await expect(
      service.create(
        {
          firstName: 'Kwame',
          lastName: 'Mensah',
          telephone: '+233244123456',
          residentialAddress: 'East Legon, Accra',
        },
        mockStaffAdmin,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should restrict Sales Agent from viewing a customer profile assigned to another agent', async () => {
    prismaService.customer.findUnique.mockResolvedValue(mockCustomer); // Assigned to agent-uuid-1

    await expect(
      service.findOne('cust-uuid-100', mockStaffAgent2), // agent-uuid-2 attempts to view
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow assigned Sales Agent to view their customer profile and calculate ledger rollups', async () => {
    prismaService.customer.findUnique.mockResolvedValue(mockCustomer); // Assigned to agent-uuid-1

    const result = await service.findOne('cust-uuid-100', mockStaffAgent1);

    expect(result.customer.id).toEqual('cust-uuid-100');
    expect(result.financialSummary).toEqual({
      totalAgreedPrice: 50000,
      totalAmountPaid: 20000,
      outstandingBalance: 30000,
    });
  });
});

