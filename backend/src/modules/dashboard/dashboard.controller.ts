import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(
    UserRole.SUPER_ADMINISTRATOR,
    UserRole.MANAGING_DIRECTOR,
    UserRole.ADMINISTRATOR,
    UserRole.SALES_AGENT,
  )
  @ApiOperation({ summary: 'Get consolidated executive management dashboard KPIs and chart data' })
  async getOverview() {
    return this.dashboardService.getOverview();
  }
}

