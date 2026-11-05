import { Module } from '@nestjs/common';
import { LandLocationsService } from './land-locations.service';
import { LandLocationsController } from './land-locations.controller';
import { PlotsService } from './plots.service';
import { PlotsController } from './plots.controller';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  controllers: [LandLocationsController, PlotsController, InventoryController],
  providers: [LandLocationsService, PlotsService, InventoryService],
  exports: [LandLocationsService, PlotsService, InventoryService],
})
export class LandInventoryModule {}
