'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  FileText,
  Printer,
  X,
  CreditCard,
  Building,
} from 'lucide-react';

export default function RefundsPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);

  // Approval Form State
  const [approvalDecision, setApprovalDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminFee, setAdminFee] = useState(1500);
  const [processingFee, setProcessingFee] = useState(500);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Disbursement Form State
  const [disburseAmount, setDisburseAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('BANK_TRANSFER');
  const [externalReference, setExternalReference] = useState('');
  const [notes, setNotes] = useState('');

  // 1. Fetch Refund Requests
  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['refund-requests'],
    queryFn: () => apiRequest('/refunds'),
  });

  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund) return;
    setIsSubmitting(true);
    setFormError(null);

    const deductions =
      approvalDecision === 'APPROVED'
        ? [
            { name: 'Administrative Processing Charge', amount: Number(adminFee), explanation: 'Office overhead' },
            { name: 'Site Plan & Inspection Deductions', amount: Number(processingFee), explanation: 'Technical logistics' },
          ]
        : [];

    try {
      await apiRequest(`/refunds/${selectedRefund.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          status: approvalDecision,
          deductions,
          rejectionReason: approvalDecision === 'REJECTED' ? rejectionReason : undefined,
        }),
      });

      setIsApprovalModalOpen(false);
      setSelectedRefund(null);
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit refund review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisbursementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/refunds/${selectedRefund.id}/disburse`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(disburseAmount),
          paymentChannel,
          transactionReference: externalReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      setIsDisburseModalOpen(false);
      setSelectedRefund(null);
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record refund disbursement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Refund Workflow</h1>
          <p className="text-xs text-slate-500 mt-1">
            Managing Director audit gate, itemized deductions calculation, plot quarantine, and disbursement tracking.
          </p>
        </div>
      </div>

      {/* Policy Alert Banner */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-950 flex items-start space-x-3">
        <ShieldAlert className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wider text-[11px] text-purple-900">
            Managing Director Authorization & Plot Quarantine Rules:
          </span>
          <p className="mt-0.5 text-purple-800 leading-relaxed">
            By system policy, customer refunds can <strong>only be approved by the Managing Director</strong>.
            Upon formal approval, the allocated land plot is automatically quarantined into <code>CANCELLED</code> status and cannot be sold without authorized re-inspection.
          </p>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : refunds.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <RotateCcw className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No active refund applications</p>
            <p className="text-xs text-slate-400 mt-1">Customer refund requests will appear here for executive audit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Refund Ref</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Plot Quarantined</th>
                  <th className="py-3 px-4 text-right">Total Payments</th>
                  <th className="py-3 px-4 text-right">Deductions</th>
                  <th className="py-3 px-4 text-right">Net Approved</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map((r: any) => {
                  const isPendingMD = r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW';
                  const isApproved = r.status === 'APPROVED_BY_MD';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-slate-900">{r.refundNumber}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold block text-slate-800">
                          {r.customer?.firstName} {r.customer?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{r.customer?.customerNumber}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {r.plot?.plotNumber} ({r.plot?.landLocation?.name})
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {formatGHS(r.totalPaymentsReceived)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium">
                        -{formatGHS(r.totalDeductions)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                        {formatGHS(r.netRefundAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPendingMD
                              ? 'bg-amber-100 text-amber-800'
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'SETTLED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {isPendingMD && hasRole(['MANAGING_DIRECTOR', 'SUPER_ADMINISTRATOR']) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRefund(r);
                                setIsApprovalModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm"
                            >
                              Review & Audit
                            </button>
                          )}
                          {isApproved && hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRefund(r);
                                setDisburseAmount(String(r.remainingRefundDue || r.netRefundAmount));
                                setIsDisburseModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-sm"
                            >
                              Disburse Payout
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MD Approval Gate Modal */}
      {isApprovalModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Managing Director Refund Audit</h3>
                <p className="text-xs text-slate-500 font-mono">Review application: {selectedRefund.refundNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
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

            <form onSubmit={handleApprovalSubmit} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant Client:</span>
                  <span className="font-bold text-slate-900">
                    {selectedRefund.customer?.firstName} {selectedRefund.customer?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Plot:</span>
                  <span className="font-bold text-slate-900">{selectedRefund.plot?.plotNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Payments Received:</span>
                  <span className="font-bold text-slate-900">{formatGHS(selectedRefund.totalPaymentsReceived)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Executive Decision</label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 p-3 rounded-lg border border-slate-200 flex-1 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVED"
                      checked={approvalDecision === 'APPROVED'}
                      onChange={() => setApprovalDecision('APPROVED')}
                    />
                    <span className="font-bold text-emerald-700">Approve with Deductions</span>
                  </label>
                  <label className="flex items-center space-x-2 p-3 rounded-lg border border-slate-200 flex-1 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="decision"
                      value="REJECTED"
                      checked={approvalDecision === 'REJECTED'}
                      onChange={() => setApprovalDecision('REJECTED')}
                    />
                    <span className="font-bold text-red-600">Reject Application</span>
                  </label>
                </div>
              </div>

              {approvalDecision === 'APPROVED' ? (
                <div className="space-y-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                    Itemized Deductions Formula
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Admin Processing Fee (GH₵)</label>
                      <input
                        type="number"
                        min="0"
                        value={adminFee}
                        onChange={(e) => setAdminFee(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Site Logistics & Survey (GH₵)</label>
                      <input
                        type="number"
                        min="0"
                        value={processingFee}
                        onChange={(e) => setProcessingFee(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex justify-between font-bold text-xs text-emerald-900">
                    <span>Net Refund Payable to Client:</span>
                    <span>
                      {formatGHS(
                        Math.max(0, Number(selectedRefund.totalPaymentsReceived) - (adminFee + processingFee)),
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Formal Rejection Reason</label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="State justification according to contractual terms..."
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Authorize Executive Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Disbursement Modal */}
      {isDisburseModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Record Refund Payout</h3>
            <p className="text-xs text-slate-500 font-mono">Disburse payment for: {selectedRefund.refundNumber}</p>

            <form onSubmit={handleDisbursementSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Channel</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money Payout</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                    <option value="CASH">Cash Office Payout</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount to Disburse (GH₵)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={disburseAmount}
                    onChange={(e) => setDisburseAmount(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">External Transaction Reference</label>
                <input
                  type="text"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. MoMo Ref # / Bank Wire Voucher"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Disbursing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
