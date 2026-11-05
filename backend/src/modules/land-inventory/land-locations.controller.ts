import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandLocationsService } from './land-locations.service';
import { CreateLandLocationDto } from './dto/create-location.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Land Locations & Acquisition Sites')
@Controller('land-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class LandLocationsController {
  constructor(private readonly locationsService: LandLocationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Register a new land acquisition site (Super Admin & Admin)' })
  async create(@Body() dto: CreateLandLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all registered land locations' })
  async findAll() {
    return this.locationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve details and landowner agreements for a specific land location' })
  async findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Get(':id/inventory-breakdown')
  @ApiOperation({ summary: 'Get total, available, reserved, sold, and partially sold plot counts for a location' })
  async getInventoryBreakdown(@Param('id') id: string) {
    return this.locationsService.getLocationInventoryBreakdown(id);
  }
}
