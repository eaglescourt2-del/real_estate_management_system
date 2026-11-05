import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Inventory Dashboard & Consolidated Analytics')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('consolidated-summary')
  @ApiOperation({ summary: 'Consolidated land inventory metrics across all acquisition sites' })
  async getConsolidatedSummary() {
    return this.inventoryService.getConsolidatedInventorySummary();
  }
}
