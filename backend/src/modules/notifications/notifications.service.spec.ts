import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './channels/whatsapp.service';
import { EmailService } from './channels/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationTriggerEvent,
} from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let whatsappService: WhatsAppService;
  let emailService: EmailService;
  let prisma: PrismaService;

  const mockCustomer = {
    id: 'cust-uuid-1',
    customerNumber: 'CUST-202611-0001',
    firstName: 'Kwame',
    lastName: 'Mensah',
    telephone: '+233244123456',
    email: 'kwame.mensah@example.gh',
  };

  const mockSettings = {
    id: 'SYSTEM_CONFIG',
    companyName: 'Ghana Real Estate Developers Ltd',
    companyPhone: '+233 30 200 0000',
    companyEmail: 'info@realestatedev.gh',
    currencySymbol: 'GH₵',
  };

  const mockPrisma = {
    notificationTemplate: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        channel: NotificationChannel.WHATSAPP,
        event: NotificationTriggerEvent.PAYMENT_RECEIVED,
        bodyTemplate:
          'Payment Confirmed: Hello {{customerName}}, received {{currency}} {{amountPaid}} for {{plotNumber}}.',
        isActive: true,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(mockSettings),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(mockCustomer),
    },
    notificationLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        WhatsAppService,
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WHATSAPP_WEBHOOK_VERIFY_TOKEN') return 'test_verify_token';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    whatsappService = module.get<WhatsAppService>(WhatsAppService);
    emailService = module.get<EmailService>(EmailService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('WhatsApp Phone Formatting', () => {
    it('should normalize international and local Ghanaian phone numbers to E.164 digits', () => {
      expect(whatsappService.formatToWhatsAppPhone('+233244123456')).toBe('233244123456');
      expect(whatsappService.formatToWhatsAppPhone('0244123456')).toBe('233244123456');
      expect(whatsappService.formatToWhatsAppPhone('233501234567')).toBe('233501234567');
      expect(whatsappService.formatToWhatsAppPhone('+233 24 412 3456')).toBe('233244123456');
    });
  });

  describe('Webhook Verification', () => {
    it('should verify challenge with valid token', () => {
      const challenge = 'challenge_123456';
      const result = whatsappService.verifyWebhook('subscribe', 'test_verify_token', challenge);
      expect(result).toBe(challenge);
    });

    it('should reject challenge with invalid token', () => {
      const result = whatsappService.verifyWebhook('subscribe', 'invalid_token', 'challenge_123');
      expect(result).toBeNull();
    });
  });

  describe('sendNotification', () => {
    it('should check idempotency and return existing record without resending if already SENT', async () => {
      const existingSentLog = {
        id: 'log-uuid-1',
        idempotencyKey: 'IDEMP-PMT-001',
        status: NotificationStatus.SENT,
        externalMessageId: 'wamid.EXISTING',
      };
      mockPrisma.notificationLog.findUnique.mockResolvedValueOnce(existingSentLog);

      const result = await service.sendNotification({
        customerId: 'cust-uuid-1',
        channel: NotificationChannel.WHATSAPP,
        event: NotificationTriggerEvent.PAYMENT_RECEIVED,
        idempotencyKey: 'IDEMP-PMT-001',
      });

      expect(result).toEqual(existingSentLog);
      expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
    });

    it('should successfully dispatch WhatsApp notification with compiled template variables', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValueOnce(null);
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce(mockSettings);
      mockPrisma.customer.findUnique.mockResolvedValueOnce(mockCustomer);

      const createdLog = {
        id: 'log-uuid-new',
        idempotencyKey: 'IDEMP-PMT-002',
        customerId: mockCustomer.id,
        channel: NotificationChannel.WHATSAPP,
        event: NotificationTriggerEvent.PAYMENT_RECEIVED,
        status: NotificationStatus.QUEUED,
        recipientDestination: '233244123456',
        messageContent: 'Payment Confirmed: Hello Kwame Mensah, received GH₵ 5,000 for Plot 12.',
      };

      mockPrisma.notificationLog.upsert.mockResolvedValueOnce(createdLog);
      mockPrisma.notificationLog.update.mockResolvedValueOnce({
        ...createdLog,
        status: NotificationStatus.SENT,
        externalMessageId: 'wamid.MOCK_12345',
        sentAt: new Date(),
      });

      const result = await service.sendNotification({
        customerId: mockCustomer.id,
        channel: NotificationChannel.WHATSAPP,
        event: NotificationTriggerEvent.PAYMENT_RECEIVED,
        idempotencyKey: 'IDEMP-PMT-002',
        templateVariables: {
          amountPaid: '5,000',
          plotNumber: 'Plot 12',
        },
      });

      expect(result.status).toBe(NotificationStatus.SENT);
      expect(mockPrisma.notificationLog.upsert).toHaveBeenCalled();
      expect(mockPrisma.notificationLog.update).toHaveBeenCalled();
    });

    it('should successfully dispatch Email notification in branded wrapper', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValueOnce(null);
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce(mockSettings);
      mockPrisma.customer.findUnique.mockResolvedValueOnce(mockCustomer);

      const createdLog = {
        id: 'log-uuid-em',
        idempotencyKey: 'IDEMP-EM-001',
        customerId: mockCustomer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
        status: NotificationStatus.QUEUED,
        recipientDestination: mockCustomer.email,
        messageContent: 'Welcome email body',
      };

      mockPrisma.notificationLog.upsert.mockResolvedValueOnce(createdLog);
      mockPrisma.notificationLog.update.mockResolvedValueOnce({
        ...createdLog,
        status: NotificationStatus.SENT,
        externalMessageId: 'msg_mock_em_123',
        sentAt: new Date(),
      });

      const result = await service.sendNotification({
        customerId: mockCustomer.id,
        channel: NotificationChannel.EMAIL,
        event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
        idempotencyKey: 'IDEMP-EM-001',
      });

      expect(result.status).toBe(NotificationStatus.SENT);
      expect(mockPrisma.notificationLog.update).toHaveBeenCalled();
    });
  });

  describe('processQueuedNotifications', () => {
    it('should process pending queued logs and mark them as SENT', async () => {
      const queuedLogs = [
        {
          id: 'queue-log-1',
          channel: NotificationChannel.WHATSAPP,
          event: NotificationTriggerEvent.PAYMENT_RECEIVED,
          recipientDestination: '+233244123456',
          messageContent: 'Test queued message 1',
          status: NotificationStatus.QUEUED,
        },
        {
          id: 'queue-log-2',
          channel: NotificationChannel.EMAIL,
          event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
          recipientDestination: 'kwame@test.gh',
          messageContent: 'Test queued message 2',
          status: NotificationStatus.QUEUED,
        },
      ];

      mockPrisma.notificationLog.findMany.mockResolvedValueOnce(queuedLogs);
      mockPrisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      mockPrisma.notificationLog.update.mockResolvedValue({});

      const outcome = await service.processQueuedNotifications(10);

      expect(outcome.processed).toBe(2);
      expect(outcome.successful).toBe(2);
      expect(outcome.failed).toBe(0);
      expect(mockPrisma.notificationLog.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleWhatsAppWebhookStatuses', () => {
    it('should update notification log status to DELIVERED when webhook delivery event arrives', async () => {
      const webhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: 'wamid.TEST_123',
                      status: 'delivered',
                      timestamp: '1730811600',
                      recipient_id: '233244123456',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const existingLog = {
        id: 'log-123',
        externalMessageId: 'wamid.TEST_123',
        status: NotificationStatus.SENT,
        deliveredAt: null,
      };

      mockPrisma.notificationLog.findFirst.mockResolvedValueOnce(existingLog);
      mockPrisma.notificationLog.update.mockResolvedValueOnce({
        ...existingLog,
        status: NotificationStatus.DELIVERED,
      });

      await service.handleWhatsAppWebhookStatuses(webhookPayload);

      expect(mockPrisma.notificationLog.findFirst).toHaveBeenCalledWith({
        where: { externalMessageId: 'wamid.TEST_123' },
      });
      expect(mockPrisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingLog.id },
          data: expect.objectContaining({
            status: NotificationStatus.DELIVERED,
          }),
        }),
      );
    });
  });
});

