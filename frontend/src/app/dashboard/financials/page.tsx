'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  XCircle,
  Clock,
  ShieldAlert,
  X,
  Filter,
} from 'lucide-react';

export default function FinancialsPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [reportPeriod, setReportPeriod] = useState('MONTHLY');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Expense Form State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('SITE_DEVELOPMENT');
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('BANK_TRANSFER');
  const [externalReference, setExternalReference] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch P&L Report
  const { data: pnlData, isLoading } = useQuery({
    queryKey: ['financials-pnl', reportPeriod],
    queryFn: () =>
      apiRequest('/financials/profit-and-loss', {
        params: { period: reportPeriod },
      }),
  });

  // 2. Fetch Expenses list
  const { data: expenses = [] } = useQuery({
    queryKey: ['financials-expenses'],
    queryFn: () => apiRequest('/financials/expenses'),
  });

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest('/financials/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: expenseTitle,
          category: expenseCategory,
          amount: Number(amount),
          paymentChannel,
          externalReference: externalReference.trim() || undefined,
          vendorName: vendorName.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      setIsExpenseModalOpen(false);
      resetExpenseForm();
      queryClient.invalidateQueries({ queryKey: ['financials-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financials-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMDApproval = async (expenseId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiRequest(`/financials/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ['financials-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financials-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      alert(err?.message || 'Action failed');
    }
  };

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseCategory('SITE_DEVELOPMENT');
    setAmount('');
    setPaymentChannel('BANK_TRANSFER');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Financials & P&L Statements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile operational income, expenses, high-value approval gates (&gt; GH₵ 5,000), and financial exports.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => downloadReport('excel')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => downloadReport('pdf')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow transition cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF Statement</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetExpenseForm();
              setIsExpenseModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Log Operational Expense</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-xs">
        <Filter className="h-4 w-4 text-slate-400 ml-1" />
        <span className="text-slate-500 font-medium">Reporting Interval:</span>
        {['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReportPeriod(p)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              reportPeriod === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* P&L Statement Summary Cards */}
      {pnlData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Gross Inflow (Collections + Fees)</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{formatGHS(pnlData.summary.totalRevenue)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{pnlData.periodLabel}</p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Outflow (Expenses + Payouts)</span>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-red-600">{formatGHS(pnlData.summary.totalExpenses)}</p>
            <p className="mt-1 text-[11px] text-slate-400">Includes landowner disbursements & approved refunds</p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Net Operational Profit</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p
              className={`mt-2 text-2xl font-extrabold ${
                pnlData.summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatGHS(pnlData.summary.netProfit)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Operating Margin: {pnlData.summary.profitMarginPercentage?.toFixed(1) || '0.0'}%
            </p>
          </div>
        </div>
      )}

      {/* Operational Expenses Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Operational Expenses Ledger
          </h3>
          <span className="text-xs text-slate-500">Expenses &gt; GH₵ 5,000 require Managing Director approval</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Title / Category</th>
                <th className="py-3 px-4">Vendor / Payee</th>
                <th className="py-3 px-4">Means of Payment</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">MD Approval</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp: any) => {
                const isPendingMD = exp.approvalStatus === 'PENDING_MD_APPROVAL';
                const isApproved = exp.approvalStatus === 'APPROVED';

                return (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{exp.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {exp.category?.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">{exp.vendorName || 'General Payee'}</td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                        {exp.paymentChannel?.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      {formatGHS(exp.amount)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPendingMD
                            ? 'bg-amber-100 text-amber-800'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {exp.approvalStatus?.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isPendingMD && hasRole(['MANAGING_DIRECTOR', 'SUPER_ADMINISTRATOR']) ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleMDApproval(exp.id, 'APPROVED')}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] cursor-pointer"
                          >
                            Authorize
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMDApproval(exp.id, 'REJECTED')}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-[10px] cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Clear</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Dialog */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Log Operational Expense</h3>
            <p className="text-xs text-slate-500">Record business expenditure and auto-trigger MD approval if &gt; GH₵ 5,000.</p>

            <form onSubmit={handleExpenseSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="e.g. Grader Bulldozer Rental for Access Roads"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="SITE_DEVELOPMENT">Site & Infrastructure Development</option>
                    <option value="SURVEY_AND_PILLARS">Surveying & Boundary Pillars</option>
                    <option value="LEGAL_AND_INDENTURE">Legal, Titling & Documentation</option>
                    <option value="MARKETING_AND_MEDIA">Marketing & Advertising</option>
                    <option value="STAFF_SALARIES">Staff Compensation</option>
                    <option value="OFFICE_OPERATIONS">Office Administration & Utilities</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Means Channel *</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money Transfer</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                    <option value="CASH">Cash Office</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 7500"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor / Payee Name</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Heavy Plant Rentals Ghana"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">External Teller / Receipt Reference</label>
                <input
                  type="text"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. Invoice #2026-991"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Logging...' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
