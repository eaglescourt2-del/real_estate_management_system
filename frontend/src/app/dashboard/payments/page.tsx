'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  FileText,
  Printer,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Smartphone,
  Building,
  Coins,
} from 'lucide-react';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // Form State
  const [allocationId, setAllocationId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('MOBILE_MONEY');
  const [paymentCategory, setPaymentCategory] = useState('INSTALMENT');
  const [externalReference, setExternalReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Payments History
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', searchTerm, channelFilter],
    queryFn: () =>
      apiRequest('/payments', {
        params: {
          search: searchTerm || undefined,
          channel: channelFilter !== 'ALL' ? channelFilter : undefined,
          limit: 50,
        },
      }),
  });

  // 2. Fetch Active Allocations for Payment Recording
  const { data: allocations = [] } = useQuery({
    queryKey: ['active-allocations'],
    queryFn: () => apiRequest('/plots/allocations/active'),
    enabled: isRecordModalOpen,
  });

  const payments = paymentsData?.payments || [];

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          allocationId,
          amount: Number(amount),
          paymentChannel,
          paymentCategory,
          externalReference: externalReference.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankBranch: bankBranch.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      setIsRecordModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      // Automatically show generated receipt
      if (res?.receipt) {
        setSelectedReceipt({
          ...res.receipt,
          customer: res.payment?.customer,
          payment: res.payment,
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAllocationId('');
    setAmount('');
    setPaymentChannel('MOBILE_MONEY');
    setPaymentCategory('INSTALMENT');
    setExternalReference('');
    setBankName('');
    setBankBranch('');
    setChequeNumber('');
    setNotes('');
    setFormError(null);
  };

  const selectedAlloc = allocations.find((a: any) => a.id === allocationId);

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'MOBILE_MONEY':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            <Smartphone className="h-3 w-3" />
            <span>Mobile Money</span>
          </span>
        );
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            <Building className="h-3 w-3" />
            <span>Bank Transfer</span>
          </span>
        );
      case 'CASH':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <Coins className="h-3 w-3" />
            <span>Direct Cash</span>
          </span>
        );
      case 'CHEQUE':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
            <FileText className="h-3 w-3" />
            <span>Cheque Deposit</span>
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{ch}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Payments & Collections</h1>
          <p className="text-xs text-slate-500 mt-1">
            Record customer installments, deposits, and full payments via Mobile Money, Bank Transfer, or Cash with PDF receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsRecordModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Record Customer Payment</span>
        </button>
      </div>

      {/* Important Clarification Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-950 flex items-start space-x-3">
        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wider text-[11px] text-emerald-900">
            External Means of Payment Selection:
          </span>
          <p className="mt-0.5 text-emerald-800 leading-relaxed">
            Payments are executed externally (e.g. via MTN MoMo / Telecel Cash, Bank Deposit, or Head Office Cashier).
            Staff record the transaction by selecting the payment channel, capturing the external reference, updating the client ledger, and issuing official PDF receipts.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 flex-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, transaction reference (TXN-...), or receipt number..."
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
        <div className="flex items-center space-x-2 text-xs border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500 font-medium">Channel:</span>
          {['ALL', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'CHEQUE'].map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannelFilter(ch)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                channelFilter === ch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {ch.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CreditCard className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No payment transactions recorded</p>
            <p className="text-xs text-slate-400 mt-1">Click "Record Customer Payment" to log collections.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Transaction / Receipt</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Channel & Reference</th>
                  <th className="py-3 px-4">Plot Allocated</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block font-mono">{p.transactionReference}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">
                        {p.customer?.firstName} {p.customer?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{p.customer?.customerNumber}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {getChannelBadge(p.paymentChannel)}
                        <span className="block text-[10px] text-slate-500 font-mono">
                          Ref: {p.externalReference || 'Direct Entry'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {p.allocation?.plot?.plotNumber} ({p.allocation?.plot?.landLocation?.name})
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                      {formatGHS(p.amount)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {p.receipt ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt({ ...p.receipt, customer: p.customer, payment: p })}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                        >
                          <Printer className="h-3 w-3" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Recording Dialog */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Customer Payment</h3>
                <p className="text-xs text-slate-500">Select payment channel, enter teller/MoMo ref, and issue receipt.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="mt-4 space-y-4 text-xs">
              {/* Plot Allocation Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Client & Active Plot Allocation *
                </label>
                <select
                  value={allocationId}
                  onChange={(e) => setAllocationId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">-- Choose Allocation --</option>
                  {allocations.map((alloc: any) => (
                    <option key={alloc.id} value={alloc.id}>
                      {alloc.customer.firstName} {alloc.customer.lastName} ({alloc.customer.customerNumber}) -{' '}
                      {alloc.plot.plotNumber} at {alloc.plot.landLocation.name} | Balance: {formatGHS(alloc.outstandingBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAlloc && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Agreed Price</span>
                    <span className="font-bold text-slate-900">{formatGHS(selectedAlloc.agreedPrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Already Paid</span>
                    <span className="font-bold text-emerald-600">{formatGHS(selectedAlloc.totalAmountPaid)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Outstanding Balance</span>
                    <span className="font-bold text-amber-600">{formatGHS(selectedAlloc.outstandingBalance)}</span>
                  </div>
                </div>
              )}

              {/* Means of Payment Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Means of Payment Channel *
                  </label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="MOBILE_MONEY">Mobile Money Transfer (MTN/Telecel/AT)</option>
                    <option value="BANK_TRANSFER">Bank Direct Transfer / Deposit</option>
                    <option value="CASH">Direct Cash Payment</option>
                    <option value="CHEQUE">Bank Cheque Deposit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Category</label>
                  <select
                    value={paymentCategory}
                    onChange={(e) => setPaymentCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="INSTALMENT">Installment Payment</option>
                    <option value="DEPOSIT">Initial Deposit</option>
                    <option value="FULL_PAYMENT">Full Outright Payment</option>
                    <option value="DOCUMENTATION_FEE">Documentation / Indenture Fee</option>
                  </select>
                </div>
              </div>

              {/* Amount & External Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount Paid (GH₵) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Transaction / Slip Ref *
                  </label>
                  <input
                    type="text"
                    required
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="e.g. MoMo TxID / Bank Deposit Slip #"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Conditional Banking Fields */}
              {(paymentChannel === 'BANK_TRANSFER' || paymentChannel === 'CHEQUE') && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. GCB Bank / Ecobank"
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {paymentChannel === 'CHEQUE' ? 'Cheque Number' : 'Branch / Teller'}
                    </label>
                    <input
                      type="text"
                      value={paymentChannel === 'CHEQUE' ? chequeNumber : bankBranch}
                      onChange={(e) =>
                        paymentChannel === 'CHEQUE' ? setChequeNumber(e.target.value) : setBankBranch(e.target.value)
                      }
                      placeholder={paymentChannel === 'CHEQUE' ? '000123' : 'Airport Branch'}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Reconciliation Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Verified by finance cashier"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Payment & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Electronic Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl border border-slate-200 animate-in fade-in">
            {/* Header */}
            <div className="border-b border-slate-200 pb-4 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-2">
                Official Electronic Payment Receipt
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                REAL ESTATE MANAGEMENT SYSTEM
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Receipt #: {selectedReceipt.receiptNumber}</p>
            </div>

            {/* Receipt Details */}
            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Client Name:</span>
                <span className="font-bold text-slate-900">
                  {selectedReceipt.customer?.firstName} {selectedReceipt.customer?.lastName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-extrabold text-emerald-700 text-base">
                  {formatGHS(selectedReceipt.amountPaid || selectedReceipt.payment?.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Means of Payment:</span>
                <span className="font-semibold text-slate-800">
                  {selectedReceipt.payment?.paymentChannel?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">External Transaction Ref:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {selectedReceipt.payment?.externalReference || 'Direct Deposit'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date Issued:</span>
                <span className="text-slate-800">
                  {new Date(selectedReceipt.issuedAt || Date.now()).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

