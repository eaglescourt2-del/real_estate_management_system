import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { ApproveRefundRequestDto } from './dto/approve-refund-request.dto';
import { DisburseRefundPaymentDto } from './dto/disburse-refund-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, RefundStatus } from '@prisma/client';

@ApiTags('Customer Refund Governance & Quarantine')
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR, UserRole.SALES_AGENT)
  @ApiOperation({
    summary: 'Submit customer refund request with proposed itemized deductions and plot quarantine',
  })
  async createRefundRequest(
    @Body() dto: CreateRefundRequestDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.refundsService.createRefundRequest(dto, staffUser);
  }

  @Get()
  @ApiOperation({ summary: 'List refund requests (auto-filtered for Sales Agents)' })
  @ApiQuery({ name: 'status', enum: RefundStatus, required: false })
  async findAll(
    @CurrentUser() staffUser: { id: string; role: UserRole },
    @Query('status') status?: RefundStatus,
  ) {
    return this.refundsService.findAll(staffUser, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve refund request details, deductions, and disbursement history' })
  async findOne(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({
    summary: 'Approve or reject customer refund & deductions (Managing Director or Super Admin only)',
  })
  async approveRefund(
    @Param('id') id: string,
    @Body() dto: ApproveRefundRequestDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.refundsService.approveRefund(id, dto, staffUser);
  }

  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({
    summary: 'Approve or reject customer refund & deductions (POST alias)',
  })
  async approveRefundPost(
    @Param('id') id: string,
    @Body() dto: ApproveRefundRequestDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.refundsService.approveRefund(id, dto, staffUser);
  }

  @Post(':id/disburse')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Record refund payment disbursed to customer (select payment channel: MoMo, Bank, Cash)',
  })
  async disburseRefundPayment(
    @Param('id') id: string,
    @Body() dto: DisburseRefundPaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.refundsService.disburseRefundPayment(id, dto, staffUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer refund request and restore quarantined plot' })
  async deleteRefundRequest(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.refundsService.deleteRefundRequest(id, staffUser);
  }
}

