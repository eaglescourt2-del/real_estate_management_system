'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { formatGHS } from '../../lib/utils';
import {
  Users,
  MapPin,
  Layers,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

export default function DashboardOverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => apiRequest('/dashboard/overview'),
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          <p className="text-xs text-slate-500">Loading executive analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h3 className="font-bold text-sm">Failed to load dashboard data</h3>
        <p className="text-xs mt-1">Please ensure the backend API service is running.</p>
      </div>
    );
  }

  const { kpis, charts, recent, actionAlerts } = data;

  return (
    <div className="space-y-8">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Management Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time key performance indicators, plot inventory, collections, and cash flow position.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Live System Synchronized
          </span>
        </div>
      </div>

      {/* Action Alerts Banner if any pending MD approvals */}
      {(actionAlerts.pendingExpenseApprovals > 0 ||
        actionAlerts.pendingRefundApprovals > 0 ||
        actionAlerts.failedNotificationsCount > 0) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Management Attention Required
              </h4>
              <div className="flex flex-wrap gap-4 text-xs text-amber-800 pt-1">
                {actionAlerts.pendingExpenseApprovals > 0 && (
                  <span>
                    &bull; <strong>{actionAlerts.pendingExpenseApprovals}</strong> Major Expense(s) (&gt; GH₵ 5,000)
                    awaiting MD authorization.
                  </span>
                )}
                {actionAlerts.pendingRefundApprovals > 0 && (
                  <span>
                    &bull; <strong>{actionAlerts.pendingRefundApprovals}</strong> Customer Refund Application(s) pending MD
                    approval.
                  </span>
                )}
                {actionAlerts.failedNotificationsCount > 0 && (
                  <span>
                    &bull; <strong>{actionAlerts.failedNotificationsCount}</strong> Notification message(s) failed delivery
                    and require review.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Collections */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Collections (Revenue)</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatGHS(kpis.financials.totalRevenueCollected)}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Agreed Sales Value:</span>
            <span className="font-semibold text-slate-700">{formatGHS(kpis.financials.totalSalesValue)}</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Outstanding Client Balances</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-600">
            {formatGHS(kpis.financials.totalOutstandingBalance)}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Collection Rate:</span>
            <span className="font-semibold text-slate-700">
              {kpis.financials.totalSalesValue > 0
                ? `${Math.round((kpis.financials.totalRevenueCollected / kpis.financials.totalSalesValue) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Landowner Obligations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Landowner Obligations</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatGHS(kpis.financials.totalLandownerPaid)}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Remaining Due:</span>
            <span className="font-semibold text-blue-700">
              {formatGHS(kpis.financials.totalLandownerOutstanding)}
            </span>
          </div>
        </div>

        {/* Net Cash Flow Position */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Operational Cash Flow</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <p
            className={`mt-2 text-2xl font-extrabold ${
              kpis.financials.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatGHS(kpis.financials.netCashFlow)}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Expenses + Refunds:</span>
            <span className="font-semibold text-slate-700">
              {formatGHS(kpis.financials.totalOperationalExpenses + kpis.financials.totalCustomerRefundsDisbursed)}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Operational Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Registered Clients</p>
            <p className="text-xl font-bold text-slate-900">{kpis.totalCustomers}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Locations</p>
            <p className="text-xl font-bold text-slate-900">{kpis.totalLocations}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Available Plots</p>
            <p className="text-xl font-bold text-emerald-600">{kpis.inventory.AVAILABLE || 0}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Plots Sold</p>
            <p className="text-xl font-bold text-slate-900">
              {(kpis.inventory.SOLD || 0) + (kpis.inventory.PARTIALLY_SOLD || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue vs Expense Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Revenue vs Operational Expenses</h3>
              <p className="text-xs text-slate-500 mt-0.5">Rolling 6-month financial performance trends (GH₵)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `GH₵${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val: any) => [formatGHS(Number(val)), '']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Collections (GH₵)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses (GH₵)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collections Breakdown by Payment Channel (Pie Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Payment Channel Distribution</h3>
            <p className="text-xs text-slate-500 mt-0.5">Means of payment recorded</p>
          </div>
          <div className="h-64 w-full">
            {charts.paymentMethodBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.paymentMethodBreakdown}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={3}
                  >
                    {charts.paymentMethodBreakdown.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatGHS(Number(val)), 'Amount']}
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No payment transactions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Breakdown by Land Location */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Plot Inventory Breakdown by Location</h3>
        <div className="space-y-4">
          {charts.locationBreakdown.map((loc: any) => {
            const soldPct = loc.totalPlots > 0 ? Math.round((loc.sold / loc.totalPlots) * 100) : 0;
            const availPct = loc.totalPlots > 0 ? Math.round((loc.available / loc.totalPlots) * 100) : 0;
            const reservedPct = loc.totalPlots > 0 ? Math.round((loc.reserved / loc.totalPlots) * 100) : 0;

            return (
              <div key={loc.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">{loc.name}</span>
                    <span className="text-[11px] text-slate-500 ml-2">({loc.region})</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 sm:mt-0">
                    <strong className="text-slate-900">{loc.totalPlots}</strong> Total Plots &bull;{' '}
                    <span className="text-emerald-700 font-semibold">{loc.available} Available</span> &bull;{' '}
                    <span className="text-blue-700 font-semibold">{loc.sold} Sold</span> &bull;{' '}
                    <span className="text-amber-700 font-semibold">{loc.reserved} Reserved</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div style={{ width: `${soldPct}%` }} className="bg-blue-600" title={`Sold: ${soldPct}%`} />
                  <div style={{ width: `${availPct}%` }} className="bg-emerald-500" title={`Available: ${availPct}%`} />
                  <div style={{ width: `${reservedPct}%` }} className="bg-amber-400" title={`Reserved: ${reservedPct}%`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Plot Allocations */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Recent Plot Allocations</h3>
          {recent.allocations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Plot Number</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2 text-right">Agreed Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.allocations.map((alloc: any) => (
                    <tr key={alloc.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">
                        {alloc.customer.firstName} {alloc.customer.lastName}
                        <span className="block text-[10px] text-slate-400">{alloc.customer.customerNumber}</span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-900">{alloc.plot.plotNumber}</td>
                      <td className="py-2.5 text-slate-600">{alloc.plot.landLocation.name}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {formatGHS(alloc.agreedPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No plot allocations recorded yet.</p>
          )}
        </div>

        {/* Recent Customer Payments */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Recent Payment Collections</h3>
          {recent.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Channel</th>
                    <th className="pb-2">Receipt #</th>
                    <th className="pb-2 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.payments.map((pmt: any) => (
                    <tr key={pmt.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-800">
                        {pmt.customer.firstName} {pmt.customer.lastName}
                        <span className="block text-[10px] text-slate-400">{pmt.transactionReference}</span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                          {pmt.paymentChannel.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">
                        {pmt.receipt?.receiptNumber || 'Pending'}
                      </td>
                      <td className="py-2.5 text-right font-bold text-emerald-700">
                        {formatGHS(pmt.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No payment records yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
