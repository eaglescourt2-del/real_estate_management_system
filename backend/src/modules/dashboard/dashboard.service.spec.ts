import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpenseApprovalStatus, PlotStatus, PlotType, RefundStatus } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrisma = {
    customer: {
      count: jest.fn().mockResolvedValue(45),
    },
    landLocation: {
      count: jest.fn().mockResolvedValue(3),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'loc-1',
          name: 'Prampram Coastal Sands',
          region: 'Greater Accra',
          plots: [
            { id: 'p1', status: PlotStatus.AVAILABLE, plotType: PlotType.FULL_PLOT },
            { id: 'p2', status: PlotStatus.SOLD, plotType: PlotType.FULL_PLOT },
          ],
        },
      ]),
    },
    plot: {
      count: jest.fn().mockResolvedValue(120),
      groupBy: jest.fn().mockResolvedValue([
        { status: PlotStatus.AVAILABLE, _count: { id: 80 } },
        { status: PlotStatus.SOLD, _count: { id: 30 } },
        { status: PlotStatus.RESERVED, _count: { id: 10 } },
      ]),
    },
    plotAllocation: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          agreedPrice: 1500000,
          totalAmountPaid: 950000,
          outstandingBalance: 550000,
        },
        _count: { id: 30 },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    landownerAgreement: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          agreedTotalAmount: 800000,
          totalPaidAmount: 400000,
        },
      }),
    },
    expense: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 120000 },
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    refundPayment: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 30000 },
      }),
    },
    customerPayment: {
      findMany: jest.fn().mockImplementation((args) => {
        if (args?.select?.paymentChannel) {
          return Promise.resolve([
            { paymentChannel: 'MOBILE_MONEY', amount: 500000 },
            { paymentChannel: 'BANK_TRANSFER', amount: 450000 },
          ]);
        }
        return Promise.resolve([]);
      }),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 150000 },
      }),
    },
    refundRequest: {
      count: jest.fn().mockResolvedValue(2),
    },
    notificationLog: {
      count: jest.fn().mockResolvedValue(0),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should compile complete executive KPIs, inventory distribution and financial totals', async () => {
    const overview = await service.getOverview();

    expect(overview).toBeDefined();
    expect(overview.kpis.totalCustomers).toBe(45);
    expect(overview.kpis.totalLocations).toBe(3);
    expect(overview.kpis.totalPlots).toBe(120);
    expect(overview.kpis.inventory.AVAILABLE).toBe(80);
    expect(overview.kpis.inventory.SOLD).toBe(30);

    // Financial totals
    expect(overview.kpis.financials.totalSalesValue).toBe(1500000);
    expect(overview.kpis.financials.totalRevenueCollected).toBe(950000);
    expect(overview.kpis.financials.totalOutstandingBalance).toBe(550000);
    expect(overview.kpis.financials.totalLandownerAgreed).toBe(800000);
    expect(overview.kpis.financials.totalLandownerPaid).toBe(400000);

    // Net Cash Flow = 950,000 - 120,000 (expense) - 400,000 (landowner) - 30,000 (refunds) = 400,000
    expect(overview.kpis.financials.netCashFlow).toBe(400000);

    // Charts & Actions
    expect(overview.charts.locationBreakdown).toHaveLength(1);
    expect(overview.charts.paymentMethodBreakdown).toHaveLength(2);
    expect(overview.charts.monthlyTrends).toHaveLength(6);
    expect(overview.actionAlerts.pendingExpenseApprovals).toBe(1);
    expect(overview.actionAlerts.pendingRefundApprovals).toBe(2);
  });
});
