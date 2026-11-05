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
import { FinancialsService } from './financials.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Daily Income, Expenses & Financial Reporting')
@Controller('financials')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Post('expenses')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Record daily business expense (select payment channel: MoMo, Bank, Cash, Cheque)',
  })
  async recordExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.financialsService.recordExpense(dto, staffUser);
  }

  @Patch('expenses/:id/approve')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR)
  @ApiOperation({ summary: 'Approve or reject major expenditure exceeding threshold (MD only)' })
  async approveExpense(
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.financialsService.approveExpense(id, dto, staffUser);
  }

  @Post('income')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Record miscellaneous operational income (select payment channel: MoMo, Bank, Cash)',
  })
  async recordIncome(
    @Body() dto: CreateIncomeDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.financialsService.recordIncome(dto, staffUser);
  }

  @Get('profit-and-loss')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Generate Profit and Loss / Cash Flow summary with period and category filters',
  })
  async getProfitAndLoss(@Query() query: FinancialReportQueryDto) {
    return this.financialsService.getProfitAndLoss(query);
  }

  @Get('export/excel')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Export complete multi-tab financial report workbook (.xlsx)',
  })
  async exportExcel(@Query() query: FinancialReportQueryDto) {
    return this.financialsService.exportExcel(query);
  }

  @Get('export/pdf')
  @Roles(UserRole.SUPER_ADMINISTRATOR, UserRole.MANAGING_DIRECTOR, UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Export executive cash flow statement as printable PDF (.pdf)',
  })
  async exportPdf(
    @Query() query: FinancialReportQueryDto,
    @CurrentUser('id') staffUserId: string,
  ) {
    return this.financialsService.exportPdf(query, staffUserId);
  }
}

