import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLandLocationDto } from './dto/create-location.dto';
import { UpdateLandLocationDto } from './dto/update-location.dto';
import { PlotStatus } from '@prisma/client';

@Injectable()
export class LandLocationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLandLocationDto) {
    const existing = await this.prisma.landLocation.findUnique({
      where: { name: dto.name.trim() },
    });

    if (existing) {
      throw new ConflictException(`Land location with name '${dto.name}' already exists.`);
    }

    return this.prisma.landLocation.create({
      data: {
        name: dto.name.trim(),
        region: dto.region.trim(),
        district: dto.district.trim(),
        geographicalAddress: dto.geographicalAddress.trim(),
        latitude: dto.latitude != null ? dto.latitude : null,
        longitude: dto.longitude != null ? dto.longitude : null,
        totalLandSizeAcres: dto.totalLandSizeAcres,
        totalPlotsCount: dto.totalPlotsCount,
        landownerName: dto.landownerName?.trim() || null,
        purchasePrice: dto.purchasePrice != null ? dto.purchasePrice : null,
        plotDimensionsDesc: dto.plotDimensionsDesc || '70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)',
        standardFullPlotPrice: dto.standardFullPlotPrice,
        standardHalfPlotPrice: dto.standardHalfPlotPrice,
      },
    });
  }

  async findAll() {
    return this.prisma.landLocation.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            plots: { where: { parentPlotId: null } },
            landownerAgreements: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.landLocation.findUnique({
      where: { id },
      include: {
        landownerAgreements: {
          include: {
            landowner: true,
          },
        },
        _count: {
          select: { plots: { where: { parentPlotId: null } } },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Land location with ID '${id}' not found.`);
    }

    return location;
  }

  async update(id: string, dto: UpdateLandLocationDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.landLocation.findFirst({
        where: { name: dto.name.trim(), NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Another land location with name '${dto.name}' already exists.`);
      }
    }

    return this.prisma.landLocation.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.region && { region: dto.region.trim() }),
        ...(dto.district && { district: dto.district.trim() }),
        ...(dto.geographicalAddress && { geographicalAddress: dto.geographicalAddress.trim() }),
        ...(dto.totalLandSizeAcres !== undefined && { totalLandSizeAcres: dto.totalLandSizeAcres }),
        ...(dto.totalPlotsCount !== undefined && { totalPlotsCount: dto.totalPlotsCount }),
        ...(dto.landownerName !== undefined && { landownerName: dto.landownerName?.trim() || null }),
        ...(dto.purchasePrice !== undefined && { purchasePrice: dto.purchasePrice }),
        ...(dto.standardFullPlotPrice !== undefined && { standardFullPlotPrice: dto.standardFullPlotPrice }),
        ...(dto.standardHalfPlotPrice !== undefined && { standardHalfPlotPrice: dto.standardHalfPlotPrice }),
        ...(dto.plotDimensionsDesc && { plotDimensionsDesc: dto.plotDimensionsDesc.trim() }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      },
    });
  }

  async remove(id: string) {
    const location = await this.findOne(id);

    // Safety check: Check if any plots under this location are allocated, reserved, or sold
    const activePlots = await this.prisma.plot.count({
      where: {
        landLocationId: id,
        status: { in: [PlotStatus.SOLD, PlotStatus.PARTIALLY_SOLD, PlotStatus.RESERVED] },
      },
    });

    if (activePlots > 0) {
      throw new ConflictException(
        `Cannot delete land location '${location.name}'. It contains ${activePlots} plot(s) that are sold, partially sold, or reserved.`,
      );
    }

    // Check if any allocations exist
    const allocationsCount = await this.prisma.plotAllocation.count({
      where: { plot: { landLocationId: id } },
    });
    if (allocationsCount > 0) {
      throw new ConflictException(
        `Cannot delete land location '${location.name}' because active plot allocations or customer contracts are linked to it.`,
      );
    }

    // Delete child plots if they are only AVAILABLE, BLOCKED, or CANCELLED
    await this.prisma.plot.deleteMany({
      where: { landLocationId: id },
    });

    return this.prisma.landLocation.delete({
      where: { id },
    });
  }

  async getLocationInventoryBreakdown(id: string) {
    const location = await this.findOne(id);

    // Query all base plots (parentPlotId === null) with their child half-plots
    const basePlots = await this.prisma.plot.findMany({
      where: { landLocationId: id, parentPlotId: null },
      include: {
        childHalfPlots: {
          select: { id: true, plotNumber: true, status: true, halfPosition: true },
        },
      },
    });

    let effectiveSold = 0;
    let fullPlotsSold = 0;
    let halfPlotsSold = 0;
    let reservedCount = 0;
    let partiallySoldCount = 0;
    let quarantinedCount = 0;

    for (const bp of basePlots) {
      if (bp.status === PlotStatus.SOLD) {
        effectiveSold += 1;
        fullPlotsSold += 1;
      } else if (bp.status === PlotStatus.RESERVED) {
        reservedCount += 1;
      } else if (bp.status === PlotStatus.CANCELLED) {
        quarantinedCount += 1;
      } else if (bp.status === PlotStatus.PARTIALLY_SOLD) {
        effectiveSold += 0.5;
        partiallySoldCount += 1;
        halfPlotsSold += 1;

        const quarantinedHalf = bp.childHalfPlots.find((h) => h.status === PlotStatus.CANCELLED);
        if (quarantinedHalf) {
          quarantinedCount += 0.5;
        }
      } else {
        const soldHalves = bp.childHalfPlots.filter((h) => h.status === PlotStatus.SOLD).length;
        const resHalves = bp.childHalfPlots.filter((h) => h.status === PlotStatus.RESERVED).length;
        const canHalves = bp.childHalfPlots.filter((h) => h.status === PlotStatus.CANCELLED).length;

        if (soldHalves === 2) {
          effectiveSold += 1;
          halfPlotsSold += 2;
        } else if (soldHalves === 1) {
          effectiveSold += 0.5;
          partiallySoldCount += 1;
          halfPlotsSold += 1;
        }

        if (resHalves > 0) {
          reservedCount += resHalves * 0.5;
        }
        if (canHalves > 0) {
          quarantinedCount += canHalves * 0.5;
        }
      }
    }

    const totalPlots = location.totalPlotsCount || (basePlots.length > 0 ? basePlots.length : 0);
    const plotsSold = effectiveSold;
    // Plots Left: Total plots minus (plots sold + reserved + quarantined pending refund)
    const plotsLeft = Math.max(0, totalPlots - (plotsSold + reservedCount + quarantinedCount));

    return {
      location: {
        id: location.id,
        name: location.name,
        region: location.region,
        district: location.district,
        geographicalAddress: location.geographicalAddress,
        totalLandSizeAcres: Number(location.totalLandSizeAcres),
        totalPlotsCount: location.totalPlotsCount,
        landownerName: location.landownerName,
        purchasePrice: location.purchasePrice ? Number(location.purchasePrice) : null,
        standardFullPlotPrice: Number(location.standardFullPlotPrice),
        standardHalfPlotPrice: Number(location.standardHalfPlotPrice),
        plotDimensionsDesc: location.plotDimensionsDesc,
      },
      inventory: {
        totalPlots,
        plotsSold,
        plotsLeft,
        availablePlots: plotsLeft,
        reservedPlots: reservedCount,
        partiallySoldPlots: partiallySoldCount,
        soldPlots: fullPlotsSold,
        halfPlotsSold,
        quarantinedPlots: quarantinedCount,
        occupancyRatePercentage: totalPlots > 0 ? Number(((plotsSold / totalPlots) * 100).toFixed(1)) : 0,
      },
    };
  }
}
