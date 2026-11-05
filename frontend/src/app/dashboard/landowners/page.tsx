'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  Building,
  Plus,
  Search,
  DollarSign,
  FileText,
  Printer,
  X,
  Phone,
  Shield,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function LandownersPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  // Form State for Landowner Disbursement
  const [agreementId, setAgreementId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('BANK_TRANSFER');
  const [externalReference, setExternalReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Landowners & Agreements
  const { data: landowners = [], isLoading } = useQuery({
    queryKey: ['landowners', searchTerm],
    queryFn: () =>
      apiRequest('/landowners', {
        params: { search: searchTerm || undefined },
      }),
  });

  // 2. Fetch Active Agreements for Payment Recording
  const { data: agreements = [] } = useQuery({
    queryKey: ['landowner-agreements'],
    queryFn: () => apiRequest('/landowners/agreements/active'),
    enabled: isDisburseModalOpen,
  });

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await apiRequest('/landowners/payments', {
        method: 'POST',
        body: JSON.stringify({
          agreementId,
          amountPaid: Number(amountPaid),
          paymentChannel,
          externalReference: externalReference.trim() || undefined,
          bankName: bankName.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      setIsDisburseModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['landowners'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      if (res?.payment) {
        setSelectedVoucher(res.payment);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record landowner payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAgreementId('');
    setAmountPaid('');
    setPaymentChannel('BANK_TRANSFER');
    setExternalReference('');
    setBankName('');
    setChequeNumber('');
    setNotes('');
    setFormError(null);
  };

  const selectedAgreement = agreements.find((a: any) => a.id === agreementId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Landowner Obligations & Agreements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track stool/family land acquisition contracts, installment payouts, and printable PDF payment vouchers.
          </p>
        </div>
        {hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']) && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsDisburseModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Landowner Payment</span>
          </button>
        )}
      </div>

      {/* Landowners List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : landowners.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No landowner agreements registered</p>
            <p className="text-xs text-slate-400 mt-1">Register land locations and agreements to monitor payouts.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {landowners.map((lo: any) => (
              <div key={lo.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{lo.fullName}</h3>
                    <p className="text-xs text-slate-500">
                      Stool / Family: <strong className="text-slate-700">{lo.familyOrStoolName || 'Direct Owner'}</strong> &bull;{' '}
                      Phone: {lo.telephone}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Bank: {lo.bankName || 'Direct MoMo'}
                    </span>
                  </div>
                </div>

                {/* Agreements under this landowner */}
                {lo.agreements && lo.agreements.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {lo.agreements.map((agr: any) => (
                      <div
                        key={agr.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{agr.landLocation?.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{agr.agreementNumber}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Agreed Total</span>
                            <span className="font-bold text-slate-800">{formatGHS(agr.agreedTotalAmount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Paid to Date</span>
                            <span className="font-bold text-emerald-600">{formatGHS(agr.totalPaidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Outstanding</span>
                            <span className="font-bold text-blue-600">{formatGHS(agr.outstandingBalance)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Landowner Payment Dialog */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Landowner Payment</h3>
                <p className="text-xs text-slate-500">Record external payout and generate formal payment voucher.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(false)}
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

            <form onSubmit={handleDisburseSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Landowner Agreement *
                </label>
                <select
                  value={agreementId}
                  onChange={(e) => setAgreementId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">-- Choose Agreement --</option>
                  {agreements.map((agr: any) => (
                    <option key={agr.id} value={agr.id}>
                      {agr.landowner?.fullName} ({agr.agreementNumber}) - {agr.landLocation?.name} | Balance: {formatGHS(agr.outstandingBalance)}
                    </option>
                  ))}
                </select>
              </div>

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
                    <option value="BANK_TRANSFER">Bank Direct Transfer / Wire</option>
                    <option value="MOBILE_MONEY">Mobile Money Transfer</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="CASH">Direct Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount to Disburse (GH₵) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Teller / Ref Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="e.g. GCB Wire #92847"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name / MoMo Network</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Stanbic Bank"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Notes / Cheque Memo</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Installment 2 of 4 for Prampram site acquisition"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Disburse & Generate Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Voucher Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="border-b border-slate-200 pb-4 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider mb-2">
                Official Landowner Payment Voucher
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                REAL ESTATE MANAGEMENT SYSTEM
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Voucher #: {selectedVoucher.voucherNumber}</p>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Beneficiary Landowner:</span>
                <span className="font-bold text-slate-900">
                  {selectedVoucher.agreement?.landowner?.fullName || 'Landowner'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount Disbursed:</span>
                <span className="font-extrabold text-blue-700 text-base">
                  {formatGHS(selectedVoucher.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Disbursement Channel:</span>
                <span className="font-semibold text-slate-800">
                  {selectedVoucher.paymentChannel?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">External Transaction Ref:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {selectedVoucher.externalReference || 'Direct Teller'}
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
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
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

