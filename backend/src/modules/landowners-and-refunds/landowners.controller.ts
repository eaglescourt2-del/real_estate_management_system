import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandownersService } from './landowners.service';
import { CreateLandownerDto } from './dto/create-landowner.dto';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { RecordLandownerPaymentDto } from './dto/record-landowner-payment.dto';
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
}
