import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PlotsService } from './plots.service';
import { BatchGeneratePlotsDto } from './dto/batch-generate-plots.dto';
import { AllocatePlotDto } from './dto/allocate-plot.dto';
import { ReservePlotDto } from './dto/reserve-plot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, PlotStatus, PlotType } from '@prisma/client';

@ApiTags('Plot Inventory & Allocation Engine')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PlotsController {
  constructor(private readonly plotsService: PlotsService) {}

  @Post('land-locations/:locationId/batch-generate-plots')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Batch generate plots following naming convention (Plot 1, Plot 1A, Plot 1B...)',
  })
  async batchGeneratePlots(
    @Param('locationId') locationId: string,
    @Body() dto: BatchGeneratePlotsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plotsService.batchGeneratePlots(locationId, dto, userId);
  }

  @Get('land-locations/:locationId/plots')
  @ApiOperation({ summary: 'List all plots in a land location with status and hierarchy' })
  @ApiQuery({ name: 'status', enum: PlotStatus, required: false })
  @ApiQuery({ name: 'plotType', enum: PlotType, required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findLocationPlots(
    @Param('locationId') locationId: string,
    @Query('status') status?: PlotStatus,
    @Query('plotType') plotType?: PlotType,
    @Query('search') search?: string,
  ) {
    return this.plotsService.findLocationPlots(locationId, { status, plotType, search });
  }

  @Get('land-locations/:locationId/available-plots')
  @ApiOperation({ summary: 'Get only available plots for allocation dropdown selection' })
  async getAvailablePlots(@Param('locationId') locationId: string) {
    return this.plotsService.getAvailablePlotsForAllocation(locationId);
  }

  @Post('plots/:plotId/allocate')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR, UserRole.SALES_AGENT)
  @ApiOperation({
    summary: 'Allocate plot to customer with full/half plot mutual exclusivity enforcement',
  })
  async allocatePlot(
    @Param('plotId') plotId: string,
    @Body() dto: AllocatePlotDto,
    @CurrentUser('id') staffUserId: string,
  ) {
    return this.plotsService.allocatePlot(plotId, dto, staffUserId);
  }

  @Post('plots/:plotId/reserve')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR, UserRole.SALES_AGENT)
  @ApiOperation({ summary: 'Place a temporary hold/reservation on an available plot' })
  async reservePlot(
    @Param('plotId') plotId: string,
    @Body() dto: ReservePlotDto,
    @CurrentUser('id') staffUserId: string,
  ) {
    return this.plotsService.reservePlot(plotId, dto, staffUserId);
  }

  @Patch('plots/:plotId/release-quarantine')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Release a cancelled/quarantined plot back to AVAILABLE inventory' })
  async releaseQuarantinedPlot(
    @Param('plotId') plotId: string,
    @Body('remarks') remarks: string,
    @CurrentUser('id') staffUserId: string,
  ) {
    return this.plotsService.releaseQuarantinedPlot(plotId, remarks || 'Verified by site inspection', staffUserId);
  }
}
