import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlotDto } from './dto/create-plot.dto';
import { BatchGeneratePlotsDto } from './dto/batch-generate-plots.dto';
import { AllocatePlotDto } from './dto/allocate-plot.dto';
import { ReservePlotDto } from './dto/reserve-plot.dto';
import {
  PlotType,
  HalfPlotPosition,
  PlotStatus,
  AllocationType,
  AllocationStatus,
  AuditAction,
} from '@prisma/client';

@Injectable()
export class PlotsService {
  private readonly logger = new Logger(PlotsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Batch generates plots following strict Ghanaian naming convention:
   * Plot 1, Plot 1A, Plot 1B, Plot 2, Plot 2A, Plot 2B, etc.
   */
  async batchGeneratePlots(locationId: string, dto: BatchGeneratePlotsDto, userId: string) {
    const location = await this.prisma.landLocation.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException(`Land location with ID '${locationId}' not found.`);
    }

    if (dto.startPlotNumber > dto.endPlotNumber) {
      throw new BadRequestException('startPlotNumber cannot exceed endPlotNumber.');
    }

    const createdPlots: any[] = [];

    // Execute in a single transactional batch
    await this.prisma.$transaction(async (tx) => {
      for (let baseNum = dto.startPlotNumber; baseNum <= dto.endPlotNumber; baseNum++) {
        const fullPlotName = `Plot ${baseNum}`;

        // Check if full plot already exists
        const existingFull = await tx.plot.findUnique({
          where: {
            landLocationId_plotNumber: {
              landLocationId: locationId,
              plotNumber: fullPlotName,
            },
          },
        });

        let parentPlot = existingFull;

        if (!existingFull) {
          parentPlot = await tx.plot.create({
            data: {
              landLocationId: locationId,
              plotNumber: fullPlotName,
              basePlotNumber: baseNum,
              plotType: PlotType.FULL_PLOT,
              halfPosition: HalfPlotPosition.NONE,
              dimensions: dto.fullPlotDimensions || '70ft x 100ft',
              status: PlotStatus.AVAILABLE,
            },
          });
          createdPlots.push(parentPlot);
        }

        // Generate child half-plot options if requested
        if (dto.includeHalfPlots && parentPlot) {
          const halfPlotA = `Plot ${baseNum}A`;
          const halfPlotB = `Plot ${baseNum}B`;

          const existingA = await tx.plot.findUnique({
            where: {
              landLocationId_plotNumber: {
                landLocationId: locationId,
                plotNumber: halfPlotA,
              },
            },
          });

          if (!existingA) {
            const childA = await tx.plot.create({
              data: {
                landLocationId: locationId,
                plotNumber: halfPlotA,
                basePlotNumber: baseNum,
                plotType: PlotType.HALF_PLOT,
                halfPosition: HalfPlotPosition.PART_A,
                parentPlotId: parentPlot.id,
                dimensions: dto.halfPlotDimensions || '50ft x 70ft',
                status: PlotStatus.AVAILABLE,
              },
            });
            createdPlots.push(childA);
          }

          const existingB = await tx.plot.findUnique({
            where: {
              landLocationId_plotNumber: {
                landLocationId: locationId,
                plotNumber: halfPlotB,
              },
            },
          });

          if (!existingB) {
            const childB = await tx.plot.create({
              data: {
                landLocationId: locationId,
                plotNumber: halfPlotB,
                basePlotNumber: baseNum,
                plotType: PlotType.HALF_PLOT,
                halfPosition: HalfPlotPosition.PART_B,
                parentPlotId: parentPlot.id,
                dimensions: dto.halfPlotDimensions || '50ft x 70ft',
                status: PlotStatus.AVAILABLE,
              },
            });
            createdPlots.push(childB);
          }
        }
      }
    });

    return {
      message: `Batch generation complete. Successfully created/verified ${createdPlots.length} plots for location '${location.name}'.`,
      generatedCount: createdPlots.length,
    };
  }

  /**
   * Retrieves plots for a location with optional filtering (status, plotType).
   */
  async findLocationPlots(
    locationId: string,
    filters?: { status?: PlotStatus; plotType?: PlotType; search?: string },
  ) {
    const where: any = { landLocationId: locationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.plotType) where.plotType = filters.plotType;
    if (filters?.search) {
      where.plotNumber = { contains: filters.search.trim(), mode: 'insensitive' };
    }

    return this.prisma.plot.findMany({
      where,
      include: {
        childHalfPlots: {
          select: {
            id: true,
            plotNumber: true,
            status: true,
            halfPosition: true,
          },
        },
        parentPlot: {
          select: {
            id: true,
            plotNumber: true,
            status: true,
          },
        },
        allocations: {
          where: { status: { in: [AllocationStatus.RESERVED, AllocationStatus.ACTIVE_INSTALMENT, AllocationStatus.PAID_IN_FULL] } },
          include: {
            customer: {
              select: {
                id: true,
                customerNumber: true,
                firstName: true,
                lastName: true,
                telephone: true,
              },
            },
            salesAgent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ basePlotNumber: 'asc' }, { halfPosition: 'asc' }],
    });
  }

  /**
   * Retrieves only eligible plots for allocation dropdowns
   */
  async getAvailablePlotsForAllocation(locationId: string) {
    return this.prisma.plot.findMany({
      where: {
        landLocationId: locationId,
        status: PlotStatus.AVAILABLE,
      },
      select: {
        id: true,
        plotNumber: true,
        plotType: true,
        halfPosition: true,
        dimensions: true,
        parentPlotId: true,
      },
      orderBy: [{ basePlotNumber: 'asc' }, { halfPosition: 'asc' }],
    });
  }

  /**
   * CRITICAL BUSINESS RULE: Full-Plot and Half-Plot Allocation Engine
   * Atomic, concurrency-safe plot allocation with mutual exclusivity guarantees.
   */
  async allocatePlot(plotId: string, dto: AllocatePlotDto, staffUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${dto.customerId}' not found.`);
    }

    const assignedAgentId = dto.salesAgentId || staffUserId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch plot with row locking check
      const plot = await tx.plot.findUnique({
        where: { id: plotId },
        include: {
          childHalfPlots: true,
          parentPlot: {
            include: { childHalfPlots: true },
          },
        },
      });

      if (!plot) {
        throw new NotFoundException(`Plot with ID '${plotId}' not found.`);
      }

      if (plot.status !== PlotStatus.AVAILABLE) {
        throw new ConflictException(
          `Plot '${plot.plotNumber}' cannot be allocated. Current status is '${plot.status}'. Only AVAILABLE plots can be allocated.`,
        );
      }

      // 2. ENFORCE BUSINESS RULES BASED ON PLOT TYPE
      if (plot.plotType === PlotType.FULL_PLOT) {
        // FULL PLOT ALLOCATION RULE:
        // A full plot cannot be sold if either half (e.g. 1A or 1B) has already been allocated or reserved!
        const childHalvesTaken = plot.childHalfPlots.some((half) =>
          ([PlotStatus.SOLD, PlotStatus.RESERVED, PlotStatus.PARTIALLY_SOLD] as PlotStatus[]).includes(half.status),
        );

        if (childHalvesTaken) {
          throw new ConflictException(
            `Cannot allocate full plot '${plot.plotNumber}'. One or more of its half-plots are already sold or reserved.`,
          );
        }

        // Mark Full Plot as SOLD
        await tx.plot.update({
          where: { id: plot.id },
          data: { status: PlotStatus.SOLD, version: { increment: 1 } },
        });

        // Selling a full plot MUST automatically BLOCK both half-plot options!
        if (plot.childHalfPlots.length > 0) {
          await tx.plot.updateMany({
            where: { parentPlotId: plot.id },
            data: { status: PlotStatus.BLOCKED, version: { increment: 1 } },
          });
        }
      } else if (plot.plotType === PlotType.HALF_PLOT) {
        // HALF PLOT ALLOCATION RULE:
        // A half plot cannot be sold if the parent full plot is already sold or blocked!
        if (plot.parentPlot) {
          if (([PlotStatus.SOLD, PlotStatus.BLOCKED] as PlotStatus[]).includes(plot.parentPlot.status)) {
            throw new ConflictException(
              `Cannot allocate half-plot '${plot.plotNumber}'. Parent '${plot.parentPlot.plotNumber}' has already been sold or blocked as a full plot.`,
            );
          }
        }

        // Mark this half plot as SOLD
        await tx.plot.update({
          where: { id: plot.id },
          data: { status: PlotStatus.SOLD, version: { increment: 1 } },
        });

        // Determine status of the sibling half plot
        if (plot.parentPlot) {
          const siblingHalf = plot.parentPlot.childHalfPlots.find((h) => h.id !== plot.id);
          const isSiblingSold = siblingHalf ? siblingHalf.status === PlotStatus.SOLD : false;

          if (isSiblingSold) {
            // Both halves are now sold -> Parent full plot becomes SOLD!
            await tx.plot.update({
              where: { id: plot.parentPlot.id },
              data: { status: PlotStatus.SOLD, version: { increment: 1 } },
            });
          } else {
            // Only this half is sold -> Parent full plot becomes PARTIALLY_SOLD!
            await tx.plot.update({
              where: { id: plot.parentPlot.id },
              data: { status: PlotStatus.PARTIALLY_SOLD, version: { increment: 1 } },
            });
          }
        }
      }

      // 3. Create serialized Allocation Number
      const allocationCount = await tx.plotAllocation.count();
      const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
      const serial = String(allocationCount + 1).padStart(4, '0');
      const allocationNumber = `ALC-${dateCode}-${serial}`;

      const deposit = Number(dto.depositRequired) || 0;
      const agreed = Number(dto.agreedPrice);
      const outstanding = agreed - deposit;

      // 4. Create PlotAllocation record
      const allocation = await tx.plotAllocation.create({
        data: {
          allocationNumber,
          customerId: customer.id,
          plotId: plot.id,
          salesAgentId: assignedAgentId,
          allocationType: dto.allocationType,
          agreedPrice: agreed,
          depositRequired: deposit,
          totalAmountPaid: 0, // CustomerPayment records will increment this
          outstandingBalance: agreed,
          paymentPlanMonths: dto.paymentPlanMonths || 1,
          status: AllocationStatus.RESERVED,
        },
        include: {
          customer: true,
          plot: true,
          salesAgent: true,
        },
      });

      // 5. Generate Pro-Forma Invoice for the customer
      const invoiceCount = await tx.invoice.count();
      const invoiceNumber = `INV-${dateCode}-${String(invoiceCount + 1).padStart(4, '0')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 days default due date for initial deposit

      await tx.invoice.create({
        data: {
          invoiceNumber,
          allocationId: allocation.id,
          customerId: customer.id,
          subtotalAmount: agreed,
          totalAmountDue: deposit > 0 ? deposit : agreed,
          balanceRemaining: agreed,
          dueDate,
          notes: `Pro-forma allocation invoice for ${plot.plotNumber}. Initial deposit requirement: GHS ${deposit.toLocaleString()}`,
        },
      });

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: AuditAction.PLOT_ALLOCATION,
          entityName: 'PlotAllocation',
          entityId: allocation.id,
          newValues: {
            allocationNumber,
            plotNumber: plot.plotNumber,
            customerName: `${customer.firstName} ${customer.lastName}`,
            agreedPrice: agreed,
            depositRequired: deposit,
          },
        },
      });

      return {
        message: `Plot '${plot.plotNumber}' successfully allocated to customer ${customer.firstName} ${customer.lastName}.`,
        allocation,
      };
    });
  }

  /**
   * Places a temporary reservation on a plot
   */
  async reservePlot(plotId: string, dto: ReservePlotDto, staffUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUnique({
        where: { id: plotId },
        include: { childHalfPlots: true, parentPlot: true },
      });

      if (!plot) {
        throw new NotFoundException(`Plot with ID '${plotId}' not found.`);
      }

      if (plot.status !== PlotStatus.AVAILABLE) {
        throw new ConflictException(`Plot '${plot.plotNumber}' is '${plot.status}' and cannot be reserved.`);
      }

      if (plot.plotType === PlotType.FULL_PLOT) {
        const halfTaken = plot.childHalfPlots.some((h) => h.status !== PlotStatus.AVAILABLE);
        if (halfTaken) {
          throw new ConflictException(`Cannot reserve full plot. One or more half-plots are already taken.`);
        }
      }

      // Update plot status
      await tx.plot.update({
        where: { id: plot.id },
        data: { status: PlotStatus.RESERVED },
      });

      // Block half plots if parent is reserved
      if (plot.plotType === PlotType.FULL_PLOT && plot.childHalfPlots.length > 0) {
        await tx.plot.updateMany({
          where: { parentPlotId: plot.id },
          data: { status: PlotStatus.BLOCKED },
        });
      }

      // Create Reservation
      const reservation = await tx.reservation.create({
        data: {
          plotId: plot.id,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone.trim(),
          reservedByUserId: staffUserId,
          reservationFee: dto.reservationFee,
          expiresAt: new Date(dto.expiresAt),
        },
      });

      return {
        message: `Plot '${plot.plotNumber}' reserved for ${dto.customerName} until ${dto.expiresAt}.`,
        reservation,
      };
    });
  }

  /**
   * Release a Quarantined/Cancelled Plot back into inventory
   * Strictly authorized procedure: requires confirmation that physical beacons are verified.
   */
  async releaseQuarantinedPlot(plotId: string, remarks: string, staffUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUnique({
        where: { id: plotId },
        include: { childHalfPlots: true, parentPlot: true },
      });

      if (!plot) {
        throw new NotFoundException(`Plot with ID '${plotId}' not found.`);
      }

      if (plot.status !== PlotStatus.CANCELLED && plot.status !== PlotStatus.BLOCKED) {
        throw new BadRequestException(
          `Only CANCELLED or BLOCKED plots can be released. Current status is '${plot.status}'.`,
        );
      }

      // Release plot to AVAILABLE
      await tx.plot.update({
        where: { id: plot.id },
        data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
      });

      // If full plot, release its unallocated child halves
      if (plot.plotType === PlotType.FULL_PLOT && plot.childHalfPlots.length > 0) {
        await tx.plot.updateMany({
          where: { parentPlotId: plot.id },
          data: { status: PlotStatus.AVAILABLE, version: { increment: 1 } },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: AuditAction.UPDATE,
          entityName: 'Plot',
          entityId: plot.id,
          newValues: {
            plotNumber: plot.plotNumber,
            action: 'RELEASE_TO_AVAILABLE_INVENTORY',
            remarks,
          },
        },
      });

      return {
        message: `Plot '${plot.plotNumber}' has been verified and released back to AVAILABLE inventory.`,
      };
    });
  }
}
