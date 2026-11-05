import { Test, TestingModule } from '@nestjs/testing';
import { PlotsService } from './plots.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import {
  PlotType,
  HalfPlotPosition,
  PlotStatus,
  AllocationType,
} from '@prisma/client';

describe('PlotsService (Stage 3 Land Inventory & Mutual Exclusivity Verification)', () => {
  let service: PlotsService;
  let prismaService: any;

  const mockCustomer = {
    id: 'cust-uuid-1',
    customerNumber: 'CUST-202611-0001',
    firstName: 'Kwame',
    lastName: 'Mensah',
    telephone: '+233244123456',
  };

  const mockFullPlot = {
    id: 'plot-1-uuid',
    landLocationId: 'loc-uuid-1',
    plotNumber: 'Plot 1',
    basePlotNumber: 1,
    plotType: PlotType.FULL_PLOT,
    halfPosition: HalfPlotPosition.NONE,
    status: PlotStatus.AVAILABLE,
    childHalfPlots: [
      {
        id: 'plot-1a-uuid',
        plotNumber: 'Plot 1A',
        status: PlotStatus.AVAILABLE,
      },
      {
        id: 'plot-1b-uuid',
        plotNumber: 'Plot 1B',
        status: PlotStatus.AVAILABLE,
      },
    ],
  };

  const mockHalfPlot1A = {
    id: 'plot-1a-uuid',
    landLocationId: 'loc-uuid-1',
    plotNumber: 'Plot 1A',
    basePlotNumber: 1,
    plotType: PlotType.HALF_PLOT,
    halfPosition: HalfPlotPosition.PART_A,
    parentPlotId: 'plot-1-uuid',
    status: PlotStatus.AVAILABLE,
    parentPlot: {
      id: 'plot-1-uuid',
      plotNumber: 'Plot 1',
      status: PlotStatus.AVAILABLE,
      childHalfPlots: [
        { id: 'plot-1a-uuid', plotNumber: 'Plot 1A', status: PlotStatus.AVAILABLE },
        { id: 'plot-1b-uuid', plotNumber: 'Plot 1B', status: PlotStatus.AVAILABLE },
      ],
    },
  };

  beforeEach(async () => {
    prismaService = {
      customer: {
        findUnique: jest.fn().mockResolvedValue(mockCustomer),
      },
      landLocation: {
        findUnique: jest.fn(),
      },
      plot: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      plotAllocation: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      invoice: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlotsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<PlotsService>(PlotsService);
  });

  it('should successfully allocate Full Plot 1 and automatically BLOCK Plot 1A and Plot 1B', async () => {
    prismaService.plot.findUnique.mockResolvedValue(mockFullPlot);
    prismaService.plot.update.mockResolvedValue({ ...mockFullPlot, status: PlotStatus.SOLD });
    prismaService.plotAllocation.create.mockResolvedValue({ id: 'alc-1' });
    prismaService.invoice.create.mockResolvedValue({ id: 'inv-1' });

    const result = await service.allocatePlot(
      'plot-1-uuid',
      {
        customerId: 'cust-uuid-1',
        allocationType: AllocationType.FULL_PLOT,
        agreedPrice: 45000,
        depositRequired: 15000,
        paymentPlanMonths: 6,
      },
      'agent-uuid-1',
    );

    expect(result.message).toContain("Plot 'Plot 1' successfully allocated");
    expect(prismaService.plot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plot-1-uuid' },
        data: expect.objectContaining({ status: PlotStatus.SOLD }),
      }),
    );
    expect(prismaService.plot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentPlotId: 'plot-1-uuid' },
        data: expect.objectContaining({ status: PlotStatus.BLOCKED }),
      }),
    );
  });

  it('should REJECT allocating Full Plot 1 if child Plot 1A is already sold', async () => {
    const conflictedPlot = {
      ...mockFullPlot,
      childHalfPlots: [
        { id: 'plot-1a-uuid', plotNumber: 'Plot 1A', status: PlotStatus.SOLD },
        { id: 'plot-1b-uuid', plotNumber: 'Plot 1B', status: PlotStatus.AVAILABLE },
      ],
    };
    prismaService.plot.findUnique.mockResolvedValue(conflictedPlot);

    await expect(
      service.allocatePlot(
        'plot-1-uuid',
        {
          customerId: 'cust-uuid-1',
          allocationType: AllocationType.FULL_PLOT,
          agreedPrice: 45000,
          depositRequired: 15000,
        },
        'agent-uuid-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should allocate Half Plot 1A, mark 1A as SOLD, and update parent Plot 1 to PARTIALLY_SOLD', async () => {
    prismaService.plot.findUnique.mockResolvedValue(mockHalfPlot1A);
    prismaService.plot.update.mockResolvedValue({ ...mockHalfPlot1A, status: PlotStatus.SOLD });
    prismaService.plotAllocation.create.mockResolvedValue({ id: 'alc-2' });
    prismaService.invoice.create.mockResolvedValue({ id: 'inv-2' });

    const result = await service.allocatePlot(
      'plot-1a-uuid',
      {
        customerId: 'cust-uuid-1',
        allocationType: AllocationType.HALF_PLOT,
        agreedPrice: 25000,
        depositRequired: 10000,
      },
      'agent-uuid-1',
    );

    expect(result.message).toContain("Plot 'Plot 1A' successfully allocated");
    // Verifies 1A marked SOLD
    expect(prismaService.plot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plot-1a-uuid' },
        data: expect.objectContaining({ status: PlotStatus.SOLD }),
      }),
    );
    // Verifies parent Plot 1 marked PARTIALLY_SOLD
    expect(prismaService.plot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plot-1-uuid' },
        data: expect.objectContaining({ status: PlotStatus.PARTIALLY_SOLD }),
      }),
    );
  });

  it('should REJECT allocating Half Plot 1A if parent Plot 1 is already SOLD as a full plot', async () => {
    const parentSoldHalfPlot = {
      ...mockHalfPlot1A,
      parentPlot: {
        id: 'plot-1-uuid',
        plotNumber: 'Plot 1',
        status: PlotStatus.SOLD,
      },
    };
    prismaService.plot.findUnique.mockResolvedValue(parentSoldHalfPlot);

    await expect(
      service.allocatePlot(
        'plot-1a-uuid',
        {
          customerId: 'cust-uuid-1',
          allocationType: AllocationType.HALF_PLOT,
          agreedPrice: 25000,
          depositRequired: 10000,
        },
        'agent-uuid-1',
      ),
    ).rejects.toThrow(ConflictException);
  });
});
