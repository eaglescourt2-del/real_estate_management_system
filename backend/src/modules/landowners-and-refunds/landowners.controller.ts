import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandownersService } from './landowners.service';
import { CreateLandownerDto } from './dto/create-landowner.dto';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { RecordLandownerPaymentDto } from './dto/record-landowner-payment.dto';
import { UpdateLandownerPaymentDto } from './dto/update-landowner-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Landowners & Land Acquisition Agreements')
@Controller('landowners')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class LandownersController {
  constructor(private readonly landownersService: LandownersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Register a new landowner / stool / family head' })
  async createLandowner(@Body() dto: CreateLandownerDto) {
    return this.landownersService.createLandowner(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'List all landowners and associated acquisition agreements' })
  async findAllLandowners() {
    return this.landownersService.findAllLandowners();
  }

  @Get('obligations')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'List all landowner obligations by land location, landowner, and purchase price' })
  async getObligations() {
    return this.landownersService.getObligations();
  }

  @Get('agreements/active')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'List active landowner agreements for disbursement' })
  async getActiveAgreements() {
    return this.landownersService.getActiveAgreements();
  }

  @Get('payments/:id')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Get landowner payment details and voucher' })
  async findOnePayment(@Param('id') id: string) {
    return this.landownersService.findOnePayment(id);
  }

  @Patch('payments/:id')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Edit an existing landowner payment record' })
  async updateLandownerPayment(
    @Param('id') id: string,
    @Body() dto: UpdateLandownerPaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.landownersService.updateLandownerPayment(id, dto, staffUser);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Get landowner profile, acquisition agreements, and complete payment history' })
  async findOneLandowner(@Param('id') id: string) {
    return this.landownersService.findOneLandowner(id);
  }

  @Post('agreements')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Create land acquisition agreement for a land location' })
  async createAgreement(
    @Body() dto: CreateAgreementDto,
    @CurrentUser('id') staffUserId: string,
  ) {
    return this.landownersService.createAgreement(dto, staffUserId);
  }

  @Post('payments')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Record payment disbursed to landowner (select payment channel: MoMo, Bank, Cash), generate PDF voucher',
  })
  async recordLandownerPayment(
    @Body() dto: RecordLandownerPaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.landownersService.recordLandownerPayment(dto, staffUser);
  }

  @Delete('obligations/:locationId')
  @ApiOperation({ summary: 'Delete a landowner obligation and agreements for a land location' })
  async deleteObligation(
    @Param('locationId') locationId: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.landownersService.deleteObligation(locationId, staffUser);
  }

  @Delete('payments/:id')
  @ApiOperation({ summary: 'Delete an existing landowner payment record' })
  async deleteLandownerPayment(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.landownersService.deleteLandownerPayment(id, staffUser);
  }
}

