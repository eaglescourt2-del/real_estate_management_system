import { Injectable, Logger } from '@nestjs/common';
import {
  ExpenseApprovalStatus,
  NotificationStatus,
  PlotStatus,
  PlotType,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    // 1. Basic entity counts
    const [totalCustomers, totalLocations, totalPlots] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.landLocation.count(),
      this.prisma.plot.count(),
    ]);

    // 2. Plot Inventory Distribution
    const plotsByStatusRaw = await this.prisma.plot.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const plotStatusCounts: Record<string, number> = {
      AVAILABLE: 0,
      RESERVED: 0,
      PARTIALLY_SOLD: 0,
      SOLD: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };

    plotsByStatusRaw.forEach((item) => {
      plotStatusCounts[item.status] = item._count.id;
    });

    // 3. Financial Totals (Sales, Payments, Balances)
    const allocationsAgg = await this.prisma.plotAllocation.aggregate({
      _sum: {
        agreedPrice: true,
        totalAmountPaid: true,
        outstandingBalance: true,
      },
      _count: { id: true },
    });

    const totalSalesValue = Number(allocationsAgg._sum.agreedPrice || 0);
    const totalRevenueCollected = Number(allocationsAgg._sum.totalAmountPaid || 0);
    const totalOutstandingBalance = Number(allocationsAgg._sum.outstandingBalance || 0);

    // 4. Landowner Acquisition Obligations
    const landownerAgg = await this.prisma.landownerAgreement.aggregate({
      _sum: {
        agreedTotalAmount: true,
        totalPaidAmount: true,
      },
    });

    const totalLandownerAgreed = Number(landownerAgg._sum.agreedTotalAmount || 0);
    const totalLandownerPaid = Number(landownerAgg._sum.totalPaidAmount || 0);
    const totalLandownerOutstanding = Math.max(0, totalLandownerAgreed - totalLandownerPaid);

    // 5. Operational Expenses & Customer Refunds
    const [expensesAgg, refundsAgg] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { approvalStatus: ExpenseApprovalStatus.APPROVED },
        _sum: { amount: true },
      }),
      this.prisma.refundPayment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    const totalOperationalExpenses = Number(expensesAgg._sum.amount || 0);
    const totalCustomerRefundsDisbursed = Number(refundsAgg._sum.amount || 0);

    // 6. Net Profit / Cash Flow Position
    // Net Position = Revenue Collected - Operational Expenses - Landowner Payouts - Refunds
    const netCashFlow =
      totalRevenueCollected -
      totalOperationalExpenses -
      totalLandownerPaid -
      totalCustomerRefundsDisbursed;

    // 7. Inventory Breakdown by Land Location
    const locationsWithPlots = await this.prisma.landLocation.findMany({
      include: {
        plots: {
          select: {
            id: true,
            status: true,
            plotType: true,
          },
        },
      },
    });

    const locationBreakdown = locationsWithPlots.map((loc) => {
      const locPlots = loc.plots;
      const available = locPlots.filter((p) => p.status === PlotStatus.AVAILABLE).length;
      const sold = locPlots.filter(
        (p) => p.status === PlotStatus.SOLD || p.status === PlotStatus.PARTIALLY_SOLD,
      ).length;
      const reserved = locPlots.filter((p) => p.status === PlotStatus.RESERVED).length;
      const blocked = locPlots.filter(
        (p) => p.status === PlotStatus.BLOCKED || p.status === PlotStatus.CANCELLED,
      ).length;

      return {
        id: loc.id,
        name: loc.name,
        region: loc.region,
        totalPlots: locPlots.length,
        available,
        sold,
        reserved,
        blocked,
      };
    });

    // 8. Payment Method Breakdown (Recharts Pie Chart)
    const paymentsForMethods = await this.prisma.customerPayment.findMany({
      select: {
        paymentChannel: true,
        amount: true,
      },
    });

    const paymentMethodMap: Record<string, { count: number; amount: number }> = {};
    for (const p of paymentsForMethods) {
      const method = p.paymentChannel;
      if (!paymentMethodMap[method]) {
        paymentMethodMap[method] = { count: 0, amount: 0 };
      }
      paymentMethodMap[method].count += 1;
      paymentMethodMap[method].amount += Number(p.amount);
    }

    const paymentMethodBreakdown = Object.entries(paymentMethodMap).map(([method, data]) => ({
      method,
      name: method.replace(/_/g, ' '),
      count: data.count,
      amount: data.amount,
    }));

    // 9. Recent 5 Plot Allocations
    const recentAllocations = await this.prisma.plotAllocation.findMany({
      take: 5,
      orderBy: { allocatedAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        plot: {
          select: {
            plotNumber: true,
            plotType: true,
            landLocation: {
              select: { name: true },
            },
          },
        },
      },
    });

    // 10. Recent 5 Customer Payments
    const recentPayments = await this.prisma.customerPayment.findMany({
      take: 5,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        receipt: {
          select: { receiptNumber: true },
        },
      },
    });

    // 11. Pending Action Items (Badges requiring management attention)
    const [pendingExpenseApprovals, pendingRefundApprovals, failedNotificationsCount] =
      await Promise.all([
        this.prisma.expense.count({
          where: { approvalStatus: ExpenseApprovalStatus.PENDING_MD_APPROVAL },
        }),
        this.prisma.refundRequest.count({
          where: { status: RefundStatus.REQUESTED },
        }),
        this.prisma.notificationLog.count({
          where: { status: NotificationStatus.FAILED },
        }),
      ]);

    // 12. Monthly Revenue vs Expense Series (Last 6 Months for Recharts Bar/Line)
    const monthlySeries = await this.generateMonthlyTrends();

    return {
      kpis: {
        totalCustomers,
        totalLocations,
        totalPlots,
        inventory: plotStatusCounts,
        financials: {
          totalSalesValue,
          totalRevenueCollected,
          totalOutstandingBalance,
          totalOperationalExpenses,
          totalLandownerAgreed,
          totalLandownerPaid,
          totalLandownerOutstanding,
          totalCustomerRefundsDisbursed,
          netCashFlow,
        },
      },
      charts: {
        monthlyTrends: monthlySeries,
        locationBreakdown,
        paymentMethodBreakdown,
      },
      recent: {
        allocations: recentAllocations,
        payments: recentPayments,
      },
      actionAlerts: {
        pendingExpenseApprovals,
        pendingRefundApprovals,
        failedNotificationsCount,
      },
    };
  }

  /**
   * Helper to aggregate the last 6 calendar months for Recharts visual trends
   */
  private async generateMonthlyTrends() {
    const trends = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const monthName = startOfMonth.toLocaleString('default', { month: 'short' });

      const [revenueAgg, expenseAgg] = await Promise.all([
        this.prisma.customerPayment.aggregate({
          where: {
            paymentDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            approvalStatus: ExpenseApprovalStatus.APPROVED,
            expenseDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const revenue = Number(revenueAgg._sum.amount || 0);
      const expenses = Number(expenseAgg._sum.amount || 0);
      const netProfit = revenue - expenses;

      trends.push({
        month: monthName,
        year: startOfMonth.getFullYear(),
        revenue,
        expenses,
        netProfit,
      });
    }

    return trends;
  }
}
