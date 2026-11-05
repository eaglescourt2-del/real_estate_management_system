import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlotStatus, AllocationStatus } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getConsolidatedInventorySummary() {
    const locations = await this.prisma.landLocation.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        region: true,
        district: true,
        totalLandSizeAcres: true,
        totalPlotsCount: true,
        standardFullPlotPrice: true,
        standardHalfPlotPrice: true,
      },
    });

    const [
      totalPlots,
      availablePlots,
      reservedPlots,
      partiallySoldPlots,
      soldPlots,
      blockedPlots,
      cancelledPlots,
    ] = await Promise.all([
      this.prisma.plot.count(),
      this.prisma.plot.count({ where: { status: PlotStatus.AVAILABLE } }),
      this.prisma.plot.count({ where: { status: PlotStatus.RESERVED } }),
      this.prisma.plot.count({ where: { status: PlotStatus.PARTIALLY_SOLD } }),
      this.prisma.plot.count({ where: { status: PlotStatus.SOLD } }),
      this.prisma.plot.count({ where: { status: PlotStatus.BLOCKED } }),
      this.prisma.plot.count({ where: { status: PlotStatus.CANCELLED } }),
    ]);

    // Aggregate monetary values from active allocations
    const activeAllocations = await this.prisma.plotAllocation.aggregate({
      where: {
        status: {
          in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT, AllocationStatus.PAID_IN_FULL],
        },
      },
      _sum: {
        agreedPrice: true,
        totalAmountPaid: true,
        outstandingBalance: true,
      },
    });

    return {
      overview: {
        totalRegisteredLocations: locations.length,
        totalPlots,
        availablePlots,
        reservedPlots,
        partiallySoldPlots,
        soldPlots,
        blockedPlots,
        cancelledPlots,
        occupancyRate: totalPlots > 0 ? Number(((soldPlots / totalPlots) * 100).toFixed(1)) : 0,
      },
      financialCommitments: {
        totalSalesValue: activeAllocations._sum.agreedPrice || 0,
        totalPaymentsReceived: activeAllocations._sum.totalAmountPaid || 0,
        outstandingReceivables: activeAllocations._sum.outstandingBalance || 0,
      },
      locationsSummary: locations,
    };
  }
}
