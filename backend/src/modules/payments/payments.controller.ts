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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Customer Payments & Financial Receipts')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR, UserRole.SALES_AGENT)
  @ApiOperation({
    summary: 'Record customer payment (MoMo, Bank, Cash), generate PDF receipt and update balance',
  })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.paymentsService.recordPayment(dto, staffUser);
  }

  @Get()
  @ApiOperation({ summary: 'List customer payment transactions with filtering and search' })
  async findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.paymentsService.findAll(query, staffUser);
  }

  @Get('active-allocations')
  @ApiOperation({ summary: 'Get active allocations for recording payments' })
  async getActiveAllocations(@CurrentUser() staffUser: { id: string; role: UserRole }) {
    return this.paymentsService.getActiveAllocations(staffUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve specific payment details, receipt link, and customer allocation' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Update customer payment details with balance adjustment' })
  async updatePayment(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.paymentsService.updatePayment(id, dto, staffUser);
  }

  @Post(':id/reverse')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({
    summary: 'Authorize payment reversal with audit trail (Super Admin & Managing Director only)',
  })
  async reversePayment(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.paymentsService.reversePayment(id, dto, staffUser);
  }
}

