import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLandLocationDto } from './dto/create-location.dto';
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
        latitude: dto.latitude,
        longitude: dto.longitude,
        totalLandSizeAcres: dto.totalLandSizeAcres,
        totalPlotsCount: dto.totalPlotsCount,
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
            plots: true,
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
          select: { plots: true },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Land location with ID '${id}' not found.`);
    }

    return location;
  }

  async getLocationInventoryBreakdown(id: string) {
    const location = await this.findOne(id);

    const [
      totalPlots,
      availablePlots,
      reservedPlots,
      partiallySoldPlots,
      soldPlots,
      blockedPlots,
      cancelledPlots,
    ] = await Promise.all([
      this.prisma.plot.count({ where: { landLocationId: id } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.AVAILABLE } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.RESERVED } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.PARTIALLY_SOLD } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.SOLD } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.BLOCKED } }),
      this.prisma.plot.count({ where: { landLocationId: id, status: PlotStatus.CANCELLED } }),
    ]);

    return {
      location: {
        id: location.id,
        name: location.name,
        region: location.region,
        district: location.district,
        standardFullPlotPrice: location.standardFullPlotPrice,
        standardHalfPlotPrice: location.standardHalfPlotPrice,
      },
      inventory: {
        totalPlots,
        availablePlots,
        reservedPlots,
        partiallySoldPlots,
        soldPlots,
        blockedPlots,
        cancelledPlots,
        occupancyRatePercentage: totalPlots > 0 ? Number(((soldPlots / totalPlots) * 100).toFixed(1)) : 0,
      },
    };
  }
}
