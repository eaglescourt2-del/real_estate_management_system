'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  Wallet,
  Plus,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  Clock,
  X,
  Filter,
  Printer,
  Building,
  Smartphone,
  Coins,
  AlertCircle,
  FileCheck,
  Calendar,
  Layers,
  Check,
  Download,
  Loader2,
  Sparkles,
  RotateCcw,
  Landmark,
  ShieldCheck,
} from 'lucide-react';

// Ghanaian Currency number to words converter for official expense vouchers
function numberToGhanaCedisWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Ghana Cedis Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion'];

  function convertChunk(num: number): string {
    let chunkStr = '';
    const hundred = Math.floor(num / 100);
    const rest = num % 100;

    if (hundred > 0) {
      chunkStr += `${units[hundred]} Hundred `;
    }

    if (rest > 0) {
      if (rest < 10) {
        chunkStr += units[rest];
      } else if (rest < 20) {
        chunkStr += teens[rest - 10];
      } else {
        const ten = Math.floor(rest / 10);
        const unit = rest % 10;
        chunkStr += tens[ten] + (unit > 0 ? `-${units[unit]}` : '');
      }
    }

    return chunkStr.trim();
  }

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let result = '';
  let tempInt = integerPart;
  let chunkIdx = 0;

  while (tempInt > 0) {
    const chunk = tempInt % 1000;
    if (chunk !== 0) {
      const chunkWords = convertChunk(chunk);
      result = `${chunkWords} ${thousands[chunkIdx]} ${result}`.trim();
    }
    tempInt = Math.floor(tempInt / 1000);
    chunkIdx++;
  }

  result = result ? `${result} Ghana Cedis` : 'Zero Ghana Cedis';

  if (decimalPart > 0) {
    result += `, ${convertChunk(decimalPart)} Pesewas`;
  }

  return `${result} Only`;
}

export default function FinancialsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [reportPeriod, setReportPeriod] = useState('MONTHLY');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Printing Modals State
  const [isPrintStatementOpen, setIsPrintStatementOpen] = useState(false);
  const [isPrintExpensesOpen, setIsPrintExpensesOpen] = useState(false);
  const [selectedExpenseForVoucher, setSelectedExpenseForVoucher] = useState<any>(null);

  // Expense Form State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('SITE_DEVELOPMENT_SURVEY');
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('CASH');
  const [externalReference, setExternalReference] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Company Settings for branding
  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiRequest('/settings').catch(() => null),
  });

  // 1. Fetch P&L Report
  const { data: pnlData, isLoading: isPnlLoading } = useQuery({
    queryKey: ['financials-pnl', reportPeriod],
    queryFn: () =>
      apiRequest('/financials/profit-and-loss', {
        params: { period: reportPeriod },
      }),
  });

  // 2. Fetch Expenses list
  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['financials-expenses'],
    queryFn: () => apiRequest('/financials/expenses'),
  });

  // Total Expenses Calculated
  const totalExpensesAmount = useMemo(() => {
    return expenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);
  }, [expenses]);

  // Outflow type helpers
  const isLandownerExpense = (exp: any) =>
    Boolean(exp.landownerPaymentId) ||
    exp.categoryCode === 'LANDOWNER_PAYMENT' ||
    exp.categoryCode === 'LAND_ACQUISITION';

  const isRefundExpense = (exp: any) =>
    Boolean(exp.refundPaymentId) ||
    exp.categoryCode === 'CUSTOMER_REFUND_DISBURSEMENT';

  // Ledger Filter State
  const [expenseFilterType, setExpenseFilterType] = useState<'ALL' | 'OPERATIONAL' | 'LANDOWNER' | 'REFUND'>('ALL');

  const operationalExpenses = useMemo(
    () => expenses.filter((e: any) => !isLandownerExpense(e) && !isRefundExpense(e)),
    [expenses]
  );
  const landownerExpenses = useMemo(() => expenses.filter(isLandownerExpense), [expenses]);
  const refundExpenses = useMemo(() => expenses.filter(isRefundExpense), [expenses]);

  const filteredExpenses = useMemo(() => {
    if (expenseFilterType === 'OPERATIONAL') return operationalExpenses;
    if (expenseFilterType === 'LANDOWNER') return landownerExpenses;
    if (expenseFilterType === 'REFUND') return refundExpenses;
    return expenses;
  }, [expenses, expenseFilterType, operationalExpenses, landownerExpenses, refundExpenses]);

  // Comprehensive Financial Metrics
  const metrics = useMemo(() => {
    if (!pnlData) return null;
    const summary = pnlData.summary || {};
    const grossRevenue = Number(summary.totalRevenue ?? summary.grossRevenue ?? 0);
    const totalLandowner = Number(summary.totalLandownerDisbursements ?? 0);
    const totalRefunds = Number(summary.totalRefundDisbursements ?? 0);
    const totalCombinedOutflow = Number(summary.totalExpenses ?? summary.totalOutflow ?? 0);

    const totalOpExpenses = Number(
      summary.totalOperationalExpenses !== undefined
        ? summary.totalOperationalExpenses
        : Math.max(0, totalCombinedOutflow - totalLandowner - totalRefunds)
    );

    const netOpProfit = Number(
      summary.netOperationalProfit !== undefined
        ? summary.netOperationalProfit
        : grossRevenue - totalOpExpenses
    );

    const opMargin = Number(
      summary.operationalProfitMarginPercentage !== undefined
        ? summary.operationalProfitMarginPercentage
        : grossRevenue > 0
          ? Number(((netOpProfit / grossRevenue) * 100).toFixed(1))
          : 0
    );

    const netOverallCash = Number(
      summary.netOverallCashFlow !== undefined
        ? summary.netOverallCashFlow
        : summary.netProfit !== undefined
          ? summary.netProfit
          : grossRevenue - totalCombinedOutflow
    );

    return {
      grossRevenue,
      totalOpExpenses,
      netOpProfit,
      opMargin,
      totalLandowner,
      totalRefunds,
      totalCombinedOutflow,
      netOverallCash,
    };
  }, [pnlData]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      setFormError('Please enter an expense title.');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid expense amount greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest('/financials/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: expenseTitle.trim(),
          categoryCode: expenseCategory,
          amount: numAmount,
          paymentChannel,
          recipient: vendorName.trim() || 'General Payee / Vendor',
          description: description.trim() || expenseTitle.trim(),
          externalReference: externalReference.trim() || undefined,
        }),
      });

      setIsExpenseModalOpen(false);
      resetExpenseForm();
      queryClient.invalidateQueries({ queryKey: ['financials-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financials-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record operational expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseCategory('SITE_DEVELOPMENT_SURVEY');
    setAmount('');
    setPaymentChannel('CASH');
    setExternalReference('');
    setVendorName('');
    setDescription('');
    setFormError(null);
  };

  const downloadReport = (format: 'excel' | 'pdf') => {
    const token = localStorage.getItem('access_token');
    const url = `/api/financials/export/${format}?period=${reportPeriod}`;
    window.open(url, '_blank');
  };

  const getChannelBadge = (ch: string) => {
    const channel = ch || '';
    if (channel.includes('MOBILE') || channel.includes('MOMO')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Smartphone className="h-3 w-3" />
          <span>{channel.includes('MTN') ? 'MTN MoMo' : channel.includes('TELECEL') ? 'Telecel Cash' : 'Mobile Money'}</span>
        </span>
      );
    }
    if (channel.includes('BANK')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Building className="h-3 w-3" />
          <span>Bank Wire / Transfer</span>
        </span>
      );
    }
    if (channel === 'CASH') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Coins className="h-3 w-3" />
          <span>Cash Office</span>
        </span>
      );
    }
    if (channel === 'CHEQUE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <FileText className="h-3 w-3" />
          <span>Cheque</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
        {channel.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Daily Financials & P&L Statements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile operational income, expenses, and official financial statements.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrintStatementOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold shadow transition cursor-pointer min-h-[40px]"
            title="Print or Save Official Profit & Loss Statement"
          >
            <Printer className="h-4 w-4" />
            <span>Print Financial Statement</span>
          </button>
          <button
            type="button"
            onClick={() => downloadReport('excel')}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition cursor-pointer min-h-[40px]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetExpenseForm();
              setIsExpenseModalOpen(true);
            }}
            className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer min-h-[40px]"
          >
            <Plus className="h-4 w-4" />
            <span>Log Operational Expense</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm gap-2">
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
          <span className="text-slate-500 font-medium">Reporting Interval:</span>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
          {['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReportPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${reportPeriod === p ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Tier KPI Metrics Grid */}
      {metrics && (
        <div className="space-y-5">
          {/* Group 1: Core Operational Performance */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2.5 px-1 gap-1">
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Core Operational Performance (Excluding Land Acquisition)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Trading & Business Profitability</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Card 1: Gross Inflow */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span className="font-semibold text-slate-700">Gross Inflow (Collections & Fees)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">{formatGHS(metrics.grossRevenue)}</p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Customer deposits & fees</span>
                  <span className="font-bold text-emerald-700">Inflow</span>
                </div>
              </div>

              {/* Card 2: Operational Expenses (Without Landowner) */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span className="font-semibold text-slate-700">Operational Expenses (Excl. Landowner)</span>
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black text-amber-700 font-mono tracking-tight">{formatGHS(metrics.totalOpExpenses)}</p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Grading, staff, fuel & admin</span>
                  <span className="font-bold text-amber-700">Core OpEx</span>
                </div>
              </div>

              {/* Card 3: Net Operational Profit (Without Landowner) */}
              <div className="p-4 sm:p-5 rounded-xl bg-emerald-50/70 border border-emerald-300 shadow-sm hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="font-bold text-emerald-950">Net Operational Profit (Excl. Landowner)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className={`mt-2 text-xl sm:text-2xl font-black font-mono tracking-tight ${metrics.netOpProfit >= 0 ? 'text-emerald-800' : 'text-red-600'}`}>
                  {formatGHS(metrics.netOpProfit)}
                </p>
                <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 font-semibold">Operating Margin</span>
                  <span className="font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {metrics.opMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Capital Outlays & Overall Cash Position */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2.5 px-1 gap-1">
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 shrink-0" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Land Capital Outflows & Overall Cash Position
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Land Holdings & Treasury</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Card 4: Total Disbursement to Landowner */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span className="font-semibold text-slate-700">Total Disbursement to Landowner</span>
                  <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 shrink-0">
                    <Building className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black text-purple-800 font-mono tracking-tight">{formatGHS(metrics.totalLandowner)}</p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Land acquisition agreements</span>
                  <span className="font-bold text-purple-700">Capital Outlay</span>
                </div>
              </div>

              {/* Card 5: Customer Refunds Paid */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span className="font-semibold text-slate-700">Customer Refunds Disbursed</span>
                  <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 shrink-0">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black text-slate-800 font-mono tracking-tight">{formatGHS(metrics.totalRefunds)}</p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Approved plot surrender payouts</span>
                  <span className="font-bold text-orange-700">Refunds</span>
                </div>
              </div>

              {/* Card 6: Net Overall Cash Flow */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span className="font-semibold text-slate-700">Net Overall Cash Flow (Cash Position)</span>
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <p className={`mt-2 text-xl sm:text-2xl font-black font-mono tracking-tight ${metrics.netOverallCash >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {formatGHS(metrics.netOverallCash)}
                </p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Total Inflow minus All Outflows</span>
                  <span className="font-mono text-slate-500 font-semibold">Outflow: {formatGHS(metrics.totalCombinedOutflow)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Expenses Table & Mobile Card List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Expenditures & Disbursements Ledger
            </h3>
            <span className="text-[11px] text-slate-500">
              Total Recorded Outflow: <strong className="text-slate-900 font-mono">{formatGHS(totalExpensesAmount)}</strong> ({expenses.length} records)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Quick Filter Tabs - with horizontal scroll on small screens */}
            <div className="flex items-center overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-sm max-w-full">
              <button
                type="button"
                onClick={() => setExpenseFilterType('ALL')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${expenseFilterType === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All ({expenses.length})
              </button>
              <button
                type="button"
                onClick={() => setExpenseFilterType('OPERATIONAL')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${expenseFilterType === 'OPERATIONAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Operational ({operationalExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setExpenseFilterType('LANDOWNER')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${expenseFilterType === 'LANDOWNER'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Landowner ({landownerExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setExpenseFilterType('REFUND')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${expenseFilterType === 'REFUND'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Refunds ({refundExpenses.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPrintExpensesOpen(true)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300 shadow-sm transition cursor-pointer shrink-0 min-h-[36px]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Ledger</span>
            </button>
          </div>
        </div>

        {/* Mobile View: Responsive Card List (Visible on phones & small tablets < 768px) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              No expenditures found matching the selected filter.
            </div>
          ) : (
            filteredExpenses.map((exp: any) => {
              const isLandowner = isLandownerExpense(exp);
              const isRefund = isRefundExpense(exp);

              return (
                <div key={exp.id} className="p-4 space-y-3 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 block">
                        {exp.expenseReference}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <div>
                      {isLandowner ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Landowner
                        </span>
                      ) : isRefund ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Refund
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Operational
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{exp.description}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {exp.categoryCode?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs">
                    <div className="text-slate-600 text-[11px]">
                      <span className="text-slate-400">Payee: </span>
                      <strong className="text-slate-800">{exp.recipient || 'General Payee'}</strong>
                    </div>
                    <div>{getChannelBadge(exp.paymentChannel)}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Amount Disbursed</span>
                      <span className="font-mono font-black text-slate-900 text-base">
                        {formatGHS(exp.amount)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Approved
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedExpenseForVoucher(exp)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold transition cursor-pointer inline-flex items-center space-x-1 text-xs min-h-[32px]"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Voucher</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop & Tablet View: Full Table (Visible on md screens >= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Ref / Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Title / Category</th>
                <th className="py-3 px-4">Vendor / Payee</th>
                <th className="py-3 px-4">Means of Payment</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    No expenditures found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp: any) => {
                  const isLandowner = isLandownerExpense(exp);
                  const isRefund = isRefundExpense(exp);

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          {exp.expenseReference}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isLandowner ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Landowner Acquisition
                          </span>
                        ) : isRefund ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Customer Refund
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Operational Exp
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{exp.description}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {exp.categoryCode?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">{exp.recipient || 'General Payee'}</td>

                      <td className="py-3 px-4">
                        {getChannelBadge(exp.paymentChannel)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm font-mono">
                        {formatGHS(exp.amount)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Approved
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseForVoucher(exp)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold transition cursor-pointer inline-flex items-center space-x-1 text-xs"
                          title="Print or Save Payment Voucher"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print Voucher</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOG OPERATIONAL EXPENSE MODAL */}
      {/* ========================================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto sm:my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Operational Expense</h3>
                <p className="text-xs text-slate-500">Record business expenditure and log into corporate ledger.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Title / Purpose *</label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="e.g. Grader Hiring for Road Opening"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="SITE_DEVELOPMENT_SURVEY">Site & Infrastructure Development</option>
                    <option value="LEGAL_DOCUMENTATION">Legal, Titling & Documentation</option>
                    <option value="MARKETING_ADVERTISING">Marketing & Advertising</option>
                    <option value="STAFF_SALARY_ALLOWANCE">Staff Compensation & Allowances</option>
                    <option value="OFFICE_RENT_UTILITIES">Office Rent & Utilities</option>
                    <option value="ADMINISTRATIVE_EXPENSE">General Office Administration</option>
                    <option value="TRANSPORTATION_FUEL">Transportation & Site Fuel</option>
                    <option value="LAND_ACQUISITION">Land Site Acquisition</option>
                    <option value="OTHER_OPERATIONAL">Other Operational Expenditure</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Means Channel *</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-semibold text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CASH">Cash Office</option>
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="MOBILE_MONEY_MTN">MTN Mobile Money</option>
                    <option value="MOBILE_MONEY_TELECEL">Telecel Cash</option>
                    <option value="MOBILE_MONEY_AT">AT Money</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 4000"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor / Payee Name *</label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. TT Company"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">External Teller / Receipt Reference (Optional)</label>
                <input
                  type="text"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. Invoice #2026-991 or MoMo ID"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Remarks / Narration (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details regarding this operational expenditure..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm sm:text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50 text-xs transition"
                >
                  {isSubmitting ? 'Logging...' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL PRINTABLE / PDF FINANCIAL STATEMENT (P&L & CASH FLOW) */}
      {/* ========================================================================= */}
      {isPrintStatementOpen && pnlData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-auto sm:my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-4 sm:px-6 py-2.5 sm:py-3 print:hidden gap-2">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-bold text-xs text-white truncate">
                  Financial Statement Preview - {reportPeriod}
                </span>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintStatementOpen(false)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 transition shadow cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Viewport Wrapper */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              <div
                id="official-financial-statement"
                className="max-w-[794px] mx-auto bg-white p-4 sm:p-7 space-y-4 sm:space-y-5 text-slate-900 font-sans shadow-lg print:shadow-none print:max-w-none print:p-0 print:m-0 w-full"
              >
                <style jsx global>{`
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 8mm 10mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      background: white !important;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                    #official-financial-statement {
                      position: static !important;
                      overflow: visible !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      box-shadow: none !important;
                      border: none !important;
                      margin: 0 !important;
                      padding: 0 !important;
                    }
                  }
                `}</style>

                {/* Company Header */}
                <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm">
                        RE
                      </div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                        {settings?.companyName || 'REAL ESTATE DEVELOPMENT GHANA LTD'}
                      </h2>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 tracking-wide mt-0.5">
                      {settings?.companyTagline || 'Ghanaian Real Estate & Land Management System'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {settings?.companyAddress || 'Accra, Greater Accra Region, Ghana'} | Tel: {settings?.companyPhone || '+233 24 000 0000'} | Email: {settings?.companyEmail || 'finance@realestateghana.com'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-[10px] sm:text-[11px] tracking-wider uppercase">
                      FINANCIAL REPORT
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Generated: {new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Report Title Banner */}
                <div className="bg-emerald-800 text-white p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                      STATEMENT OF PROFIT & LOSS AND CASH FLOW
                    </h3>
                    <p className="text-[11px] sm:text-xs text-emerald-100 font-medium">
                      Operating Performance & Financial Reconciliation
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-white bg-emerald-900/60 px-3 py-1 rounded-lg">
                      {pnlData.periodLabel || pnlData.period?.label || reportPeriod}
                    </span>
                  </div>
                </div>

                {/* Executive Snapshot Cards - 2 Tiers */}
                {metrics && (
                  <div className="space-y-2.5">
                    {/* Tier 1: Core Operations */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[9px] font-bold uppercase text-emerald-800 block">Gross Inflow (Revenue)</span>
                        <span className="text-sm font-extrabold text-emerald-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.grossRevenue)}
                        </span>
                        <span className="text-[8px] text-emerald-700">Collections & Fees</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[9px] font-bold uppercase text-amber-800 block">Operational Exp (Excl. LO)</span>
                        <span className="text-sm font-extrabold text-amber-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.totalOpExpenses)}
                        </span>
                        <span className="text-[8px] text-amber-700">Grading, staff, fuel & admin</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-300">
                        <span className="text-[9px] font-bold uppercase text-emerald-900 block">Net Operational Profit</span>
                        <span className="text-sm font-extrabold text-emerald-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.netOpProfit)}
                        </span>
                        <span className="text-[8px] font-bold text-emerald-800">
                          Margin: {metrics.opMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Tier 2: Capital Outflows & Overall Cash Position */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                        <span className="text-[9px] font-bold uppercase text-purple-800 block">Disbursed to Landowners</span>
                        <span className="text-sm font-extrabold text-purple-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.totalLandowner)}
                        </span>
                        <span className="text-[8px] text-purple-700">Land acquisition agreements</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                        <span className="text-[9px] font-bold uppercase text-orange-800 block">Customer Refunds Disbursed</span>
                        <span className="text-sm font-extrabold text-orange-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.totalRefunds)}
                        </span>
                        <span className="text-[8px] text-orange-700">Plot cancellations paid</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                        <span className="text-[9px] font-bold uppercase text-slate-800 block">Net Overall Cash Position</span>
                        <span className="text-sm font-extrabold text-slate-950 font-mono mt-0.5 block">
                          {formatGHS(metrics.netOverallCash)}
                        </span>
                        <span className="text-[8px] text-slate-600">
                          Total Outflow: {formatGHS(metrics.totalCombinedOutflow)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 1: Revenue Breakdown */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                    1. Cash Receipts & Revenue Breakdown
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="p-2 text-left">Revenue Source Category</th>
                          <th className="p-2 text-right">Amount (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.keys(pnlData.revenueBreakdown || {}).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="p-2 text-slate-400 italic">No revenue recorded in this period</td>
                          </tr>
                        ) : (
                          Object.entries(pnlData.revenueBreakdown || {}).map(([cat, amt]: any) => (
                            <tr key={cat}>
                              <td className="p-2 text-slate-800 font-medium">{cat.replace(/_/g, ' ')}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">{formatGHS(amt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="p-2 text-slate-900">Total Cash Inflow:</td>
                          <td className="p-2 text-right font-mono text-emerald-800">{formatGHS(metrics?.grossRevenue ?? pnlData.summary.totalRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Section 2: Core Operating Expenses Breakdown */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                    2. Core Operational Expenditures (Excluding Landowner Acquisitions)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="p-2 text-left">Operational Expense Category</th>
                          <th className="p-2 text-right">Amount (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(pnlData.expenseBreakdown || {})
                          .filter(([cat]) => cat !== 'LANDOWNER_PAYMENT' && cat !== 'LAND_ACQUISITION' && cat !== 'CUSTOMER_REFUND_DISBURSEMENT')
                          .map(([cat, amt]: any) => (
                            <tr key={cat}>
                              <td className="p-2 text-slate-800 font-medium">{cat.replace(/_/g, ' ')}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">{formatGHS(amt)}</td>
                            </tr>
                          ))}
                        {Object.entries(pnlData.expenseBreakdown || {}).filter(
                          ([cat]) => cat !== 'LANDOWNER_PAYMENT' && cat !== 'LAND_ACQUISITION' && cat !== 'CUSTOMER_REFUND_DISBURSEMENT'
                        ).length === 0 && (
                            <tr>
                              <td colSpan={2} className="p-2 text-slate-400 italic">No operational expenses recorded in this period</td>
                            </tr>
                          )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-amber-50/60 font-bold">
                          <td className="p-2 text-slate-900">Total Operational Expenses (Excl. Landowner):</td>
                          <td className="p-2 text-right font-mono text-amber-800">{formatGHS(metrics?.totalOpExpenses ?? 0)}</td>
                        </tr>
                        <tr className="border-t border-slate-300 bg-emerald-50 font-bold">
                          <td className="p-2 text-emerald-950">Net Operational Profit (Core Operations):</td>
                          <td className="p-2 text-right font-mono text-emerald-900">
                            {formatGHS(metrics?.netOpProfit ?? 0)} ({metrics?.opMargin.toFixed(1)}% Margin)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Section 3: Capital Outlays & Landowner Obligations */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                    3. Capital Land Acquisitions & Customer Refunds
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="p-2 text-left">Capital Outlay / Payout Description</th>
                          <th className="p-2 text-right">Amount (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-2 text-slate-800 font-medium">Total Disbursements to Landowners (Land Acquisitions)</td>
                          <td className="p-2 text-right font-mono font-bold text-purple-900">{formatGHS(metrics?.totalLandowner ?? 0)}</td>
                        </tr>
                        <tr>
                          <td className="p-2 text-slate-800 font-medium">Total Customer Refunds Disbursed (Plot Cancellations)</td>
                          <td className="p-2 text-right font-mono font-bold text-orange-900">{formatGHS(metrics?.totalRefunds ?? 0)}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="p-2 text-slate-900">Total Combined Outflows (Operating + Land):</td>
                          <td className="p-2 text-right font-mono text-slate-900">{formatGHS(metrics?.totalCombinedOutflow ?? pnlData.summary.totalExpenses)}</td>
                        </tr>
                        <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-bold">
                          <td className="p-2">NET OVERALL CASH POSITION / PERIOD SURPLUS (DEFICIT):</td>
                          <td className="p-2 text-right font-mono">{formatGHS(metrics?.netOverallCash ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Balance Sheet Notes */}
                {pnlData.balanceSheetNotes && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-700 block mb-1">
                      Balance Sheet & Receivables Snapshot:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-[11px]">
                      <div>
                        <span className="text-slate-500">Accounts Receivable (Customer Balances):</span>
                        <strong className="block text-slate-900 font-mono">
                          {formatGHS(pnlData.balanceSheetNotes.customerReceivablesOutstanding || 0)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Landowner Payables Outstanding:</span>
                        <strong className="block text-slate-900 font-mono">
                          {formatGHS(pnlData.balanceSheetNotes.landownerObligationsOutstanding || 0)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sign-off Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t-2 border-slate-900 text-xs print:grid-cols-2">
                  <div className="p-3 rounded-xl border border-slate-300 bg-white min-h-[110px] sm:min-h-[120px] flex flex-col justify-between">
                    <span className="font-bold text-[10px] uppercase text-slate-800 text-center border-b pb-1">
                      Prepared By (Accounts Officer)
                    </span>
                    <div className="my-auto text-center py-2">
                      <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto" />
                      <span className="text-[10px] text-slate-400 mt-1 block">Officer Signature</span>
                    </div>
                    <div className="text-[10px] text-slate-600 space-y-0.5">
                      <p>Date: _____ / _____ / 20____</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-300 bg-white min-h-[110px] sm:min-h-[120px] flex flex-col justify-between">
                    <span className="font-bold text-[10px] uppercase text-slate-800 text-center border-b pb-1">
                      Certified & Audited By (Managing Director)
                    </span>
                    <div className="my-auto text-center py-2">
                      <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto" />
                      <span className="text-[10px] text-slate-400 mt-1 block">Executive Endorsement Signature</span>
                    </div>
                    <div className="text-[10px] text-slate-600 space-y-0.5">
                      <p>Date: _____ / _____ / 20____</p>
                    </div>
                  </div>
                </div>

                {/* Corporate Stamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-500 gap-1.5">
                  <span>Confidential Internal Financial Statement. Real Estate Development Ghana Ltd.</span>
                  <div className="border border-dashed border-slate-400 px-3 py-1 rounded text-slate-400 font-bold uppercase text-center self-start sm:self-auto">
                    Affix Official Stamp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* OFFICIAL PRINTABLE EXPENSES LEDGER MODAL */}
      {/* ========================================================================= */}
      {isPrintExpensesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-auto sm:my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-4 sm:px-6 py-2.5 sm:py-3 print:hidden gap-2">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="font-bold text-xs text-white truncate">
                  Expenses Ledger Preview
                </span>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Expenses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintExpensesOpen(false)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 transition shadow cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Viewport Wrapper */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              <div
                id="official-expenses-ledger"
                className="max-w-[794px] mx-auto bg-white p-4 sm:p-7 space-y-4 text-slate-900 font-sans shadow-lg print:shadow-none print:max-w-none print:p-0 print:m-0 w-full overflow-x-auto"
              >
                <style jsx global>{`
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 8mm 10mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      background: white !important;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                    #official-expenses-ledger {
                      position: static !important;
                      overflow: visible !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      box-shadow: none !important;
                      border: none !important;
                      margin: 0 !important;
                      padding: 0 !important;
                    }
                  }
                `}</style>

                {/* Company Header */}
                <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-950 uppercase">
                      {settings?.companyName || 'REAL ESTATE DEVELOPMENT GHANA LTD'}
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      {settings?.companyAddress || 'Accra, Greater Accra Region, Ghana'} | Tel: {settings?.companyPhone || '+233 24 000 0000'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-[10px] uppercase">
                      EXPENSES DISBURSEMENT LEDGER
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Generated: {new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Summary Banner with Clear Breakdown */}
                <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Combined Cash Disbursed:</span>
                      <span className="text-lg font-black text-amber-400 font-mono">{formatGHS(totalExpensesAmount)}</span>
                    </div>
                    <div className="text-left sm:text-right text-[11px] text-slate-300">
                      <span>Total Expense Records: <strong className="text-white">{expenses.length}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] pt-1">
                    <div className="p-1.5 rounded bg-slate-800/80 border border-slate-700">
                      <span className="text-slate-400 block">Operational OpEx:</span>
                      <strong className="text-amber-300 font-mono font-bold">
                        {formatGHS(operationalExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                      </strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/80 border border-slate-700">
                      <span className="text-slate-400 block">Landowner Disbursements:</span>
                      <strong className="text-purple-300 font-mono font-bold">
                        {formatGHS(landownerExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                      </strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/80 border border-slate-700">
                      <span className="text-slate-400 block">Customer Refunds:</span>
                      <strong className="text-orange-300 font-mono font-bold">
                        {formatGHS(refundExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2">Ref / Date</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Title & Purpose</th>
                        <th className="p-2">Payee / Vendor</th>
                        <th className="p-2">Means</th>
                        <th className="p-2 text-right">Amount (GHS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 italic">No expense records</td>
                        </tr>
                      ) : (
                        expenses.map((exp: any) => {
                          const isLo = isLandownerExpense(exp);
                          const isRef = isRefundExpense(exp);

                          return (
                            <tr key={exp.id}>
                              <td className="p-2">
                                <span className="font-mono font-bold text-[11px] block">{exp.expenseReference}</span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                                </span>
                              </td>
                              <td className="p-2">
                                {isLo ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                    Landowner
                                  </span>
                                ) : isRef ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    Refund
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                    Operational
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-[10px] text-slate-600 font-medium">
                                {exp.categoryCode?.replace(/_/g, ' ')}
                              </td>
                              <td className="p-2 font-medium text-slate-900 max-w-xs truncate">
                                {exp.description}
                              </td>
                              <td className="p-2 text-slate-700">{exp.recipient}</td>
                              <td className="p-2 text-[10px] text-slate-600 font-medium">
                                {exp.paymentChannel?.replace(/_/g, ' ')}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-slate-950">
                                {formatGHS(exp.amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold text-xs">
                        <td colSpan={6} className="p-2 text-right text-slate-900">Total Disbursements:</td>
                        <td className="p-2 text-right font-mono font-black text-slate-950">
                          {formatGHS(totalExpensesAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Sign-off Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-3 border-t border-slate-300 text-xs print:grid-cols-2">
                  <div className="p-2.5 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase mb-6">
                      Prepared By (Disbursing Officer)
                    </span>
                    <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto" />
                    <span className="text-[10px] text-slate-400 mt-1 block">Officer Signature & Date</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase mb-6">
                      Approved By (Financial Controller / MD)
                    </span>
                    <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto" />
                    <span className="text-[10px] text-slate-400 mt-1 block">Executive Signature & Date</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INDIVIDUAL EXPENSE PAYMENT DISBURSEMENT VOUCHER MODAL */}
      {/* ========================================================================= */}
      {selectedExpenseForVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-auto sm:my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-4 sm:px-6 py-2.5 sm:py-3 print:hidden gap-2">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-white truncate">
                  Payment Disbursement Voucher - {selectedExpenseForVoucher.expenseReference}
                </span>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedExpenseForVoucher(null)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 transition shadow cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Viewport Wrapper */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              <div
                id="individual-expense-voucher"
                className="max-w-[794px] mx-auto bg-white p-4 sm:p-7 space-y-4 text-slate-900 font-sans shadow-lg print:shadow-none print:max-w-none print:p-0 print:m-0 w-full"
              >
                <style jsx global>{`
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 8mm 10mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      background: white !important;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                    #individual-expense-voucher {
                      position: static !important;
                      overflow: visible !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      box-shadow: none !important;
                      border: none !important;
                      margin: 0 !important;
                      padding: 0 !important;
                    }
                  }
                `}</style>

                {/* Voucher Header */}
                <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-950 uppercase">
                      {settings?.companyName || 'REAL ESTATE DEVELOPMENT GHANA LTD'}
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      {settings?.companyAddress || 'Accra, Greater Accra Region, Ghana'} | Tel: {settings?.companyPhone || '+233 24 000 0000'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs uppercase">
                      PAYMENT DISBURSEMENT VOUCHER
                    </span>
                    <p className="text-xs text-slate-600 mt-1 font-mono font-bold">
                      {selectedExpenseForVoucher.expenseReference}
                    </p>
                  </div>
                </div>

                {/* Key Details Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Paid To (Payee / Vendor):</span>
                    <strong className="text-sm text-slate-900 block mt-0.5">{selectedExpenseForVoucher.recipient}</strong>
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Category: {selectedExpenseForVoucher.categoryCode?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Date Disbursed:</span>
                    <strong className="text-xs text-slate-900 block mt-0.5">
                      {new Date(selectedExpenseForVoucher.expenseDate).toLocaleDateString('en-GB')}
                    </strong>
                    <span className="text-[11px] text-slate-600 mt-1 block font-mono">
                      Channel: {selectedExpenseForVoucher.paymentChannel?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Amount in Figures and Words */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="font-bold text-xs text-emerald-950 uppercase">Amount Paid (Figures):</span>
                    <span className="text-xl font-black text-emerald-900 font-mono">
                      {formatGHS(selectedExpenseForVoucher.amount)}
                    </span>
                  </div>
                  <div className="border-t border-emerald-200/80 pt-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Amount in Words:</span>
                    <p className="text-xs font-semibold text-emerald-950 italic mt-0.5">
                      {numberToGhanaCedisWords(Number(selectedExpenseForVoucher.amount))}
                    </p>
                  </div>
                </div>

                {/* Purpose / Description */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Particulars & Purpose of Expenditure:</span>
                  <p className="text-slate-900 font-medium">{selectedExpenseForVoucher.description}</p>
                  {selectedExpenseForVoucher.supportingReceiptUrl && (
                    <p className="text-[11px] text-slate-500 font-mono pt-1">
                      Supporting Ref: {selectedExpenseForVoucher.supportingReceiptUrl}
                    </p>
                  )}
                </div>

                {/* 3 Signatures */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-300 text-xs print:grid-cols-3">
                  <div className="p-2.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between min-h-[100px] sm:min-h-[105px]">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase border-b pb-1">
                      Prepared By (Cashier)
                    </span>
                    <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto my-auto" />
                    <span className="text-[9px] text-slate-400 block">
                      {selectedExpenseForVoucher.recordedByUser
                        ? `${selectedExpenseForVoucher.recordedByUser.firstName} ${selectedExpenseForVoucher.recordedByUser.lastName}`
                        : 'Accounts Officer'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between min-h-[100px] sm:min-h-[105px]">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase border-b pb-1">
                      Authorized By (Accounts Head)
                    </span>
                    <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto my-auto" />
                    <span className="text-[9px] text-slate-400 block">Managing Director / Controller</span>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between min-h-[100px] sm:min-h-[105px]">
                    <span className="text-[10px] font-bold text-slate-700 block uppercase border-b pb-1">
                      Received By (Payee)
                    </span>
                    <div className="border-b border-slate-900 border-dashed w-3/4 mx-auto my-auto" />
                    <span className="text-[9px] text-slate-400 block">Payee Signature & Date</span>
                  </div>
                </div>

                {/* Stamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-500 gap-1.5">
                  <span>Official Disbursement Voucher. Real Estate Development Ghana Ltd.</span>
                  <div className="border border-dashed border-slate-400 px-3 py-0.5 rounded text-slate-400 font-bold uppercase text-center self-start sm:self-auto">
                    Paid Stamp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
