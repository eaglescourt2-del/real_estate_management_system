'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  FileText,
  Printer,
  X,
  CreditCard,
  Building,
  History,
  PlusCircle,
  Download,
  Search,
  ArrowRight,
  Clock,
  ShieldCheck,
  Check,
  Trash2,
} from 'lucide-react';

// Number to words converter for Ghanaian Currency receipts
function numberToGhanaCedisWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Ghana Cedis Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion'];

  function convertChunk(num: number): string {
    let chunkStr = '';
    const hundred = Math.floor(num / 100);
    const rest = num % 100;

    if (hundred > 0) {
      chunkStr += `${units[hundred]} Hundred`;
      if (rest > 0) chunkStr += ' and ';
    }

    if (rest >= 10 && rest < 20) {
      chunkStr += teens[rest - 10];
    } else if (rest >= 20) {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      chunkStr += tens[t];
      if (u > 0) chunkStr += `-${units[u]}`;
    } else if (rest > 0) {
      chunkStr += units[rest];
    }

    return chunkStr.trim();
  }

  const integerPart = Math.floor(amount);
  const pesewas = Math.round((amount - integerPart) * 100);

  if (integerPart === 0 && pesewas > 0) {
    return `${convertChunk(pesewas)} Pesewas Only`;
  }

  let words = '';
  let temp = integerPart;
  let chunkIdx = 0;

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkText = convertChunk(chunk);
      const scale = thousands[chunkIdx];
      words = `${chunkText} ${scale} ${words}`.trim();
    }
    temp = Math.floor(temp / 1000);
    chunkIdx++;
  }

  words = `${words} Ghana Cedis`;

  if (pesewas > 0) {
    words += `, ${convertChunk(pesewas)} Pesewas`;
  }

  return `${words} Only`;
}

export default function RefundsPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Approval Form State
  const [approvalDecision, setApprovalDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalFormError, setApprovalFormError] = useState<string | null>(null);

  // Add Payment / Disbursement Form State
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [disbursementDate, setDisbursementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);

  // Delete Refund State
  const [refundToDelete, setRefundToDelete] = useState<any>(null);
  const [isDeletingRefund, setIsDeletingRefund] = useState(false);
  const [deleteRefundError, setDeleteRefundError] = useState<string | null>(null);

  const handleDeleteRefund = async () => {
    if (!refundToDelete) return;
    setIsDeletingRefund(true);
    setDeleteRefundError(null);
    try {
      await apiRequest(`/refunds/${refundToDelete.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['refunds'] });
      await queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['plots'] });
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setRefundToDelete(null);
    } catch (err: any) {
      setDeleteRefundError(err?.message || 'Failed to delete refund request.');
    } finally {
      setIsDeletingRefund(false);
    }
  };

  // Fetch Company Settings for receipts
  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiRequest('/settings').catch(() => null),
  });

  // Fetch Refund Requests
  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['refund-requests'],
    queryFn: () => apiRequest('/refunds'),
  });

  // Filtered Refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r: any) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING') {
          if (r.status !== 'REQUESTED' && r.status !== 'UNDER_REVIEW') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const refNum = (r.refundNumber || '').toLowerCase();
      const custName = `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`.toLowerCase();
      const custNum = (r.customer?.customerNumber || '').toLowerCase();
      const plotNum = (r.plot?.plotNumber || '').toLowerCase();
      const locName = (r.plot?.landLocation?.name || '').toLowerCase();

      return (
        refNum.includes(term) ||
        custName.includes(term) ||
        custNum.includes(term) ||
        plotNum.includes(term) ||
        locName.includes(term)
      );
    });
  }, [refunds, searchTerm, statusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCount = refunds.length;
    const pendingAudit = refunds.filter((r: any) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW').length;
    const approvedRefunds = refunds.filter(
      (r: any) => r.status === 'APPROVED' || r.status === 'PARTIALLY_REFUNDED' || r.status === 'FULLY_REFUNDED',
    );
    const totalApprovedNet = approvedRefunds.reduce((acc: number, r: any) => acc + Number(r.netRefundAmount || 0), 0);
    const totalDisbursed = approvedRefunds.reduce((acc: number, r: any) => acc + Number(r.totalRefundPaid || 0), 0);
    const totalRemainingDue = Math.max(0, totalApprovedNet - totalDisbursed);

    return { totalCount, pendingAudit, totalApprovedNet, totalDisbursed, totalRemainingDue };
  }, [refunds]);

  // Handle MD Approval Submission
  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund) return;
    setIsSubmittingApproval(true);
    setApprovalFormError(null);

    const isApproved = approvalDecision === 'APPROVED';

    try {
      await apiRequest(`/refunds/${selectedRefund.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approved: isApproved,
          status: approvalDecision,
          remarks: approvalRemarks.trim() || undefined,
          rejectionReason: !isApproved ? rejectionReason.trim() : undefined,
        }),
      });

      setIsApprovalModalOpen(false);
      setSelectedRefund(null);
      setApprovalRemarks('');
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setApprovalFormError(err?.message || 'Failed to submit refund review');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Open Add Payment Modal
  const handleOpenAddPayment = (refund: any) => {
    setSelectedRefund(refund);
    const remaining = Number(refund.remainingRefundDue ?? refund.netRefundAmount);
    setPaymentAmountInput(String(remaining > 0 ? remaining : ''));
    setPaymentChannel('BANK_TRANSFER');
    setTransactionReference('');
    setDisbursementDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes('');
    setPaymentFormError(null);
    setIsAddPaymentModalOpen(true);
  };

  // Open Payment History Modal
  const handleOpenHistory = (refund: any) => {
    setSelectedRefund(refund);
    setIsHistoryModalOpen(true);
  };

  // Open Receipt Modal
  const handleViewReceipt = (refund: any, disbursement: any) => {
    setSelectedReceipt({
      disbursement,
      refund,
      customer: refund.customer,
      plot: refund.plot,
    });
    setIsReceiptModalOpen(true);
  };

  // Handle Disbursement / Add Payment Submission
  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund) return;

    const amountNum = parseFloat(paymentAmountInput);
    const remainingDue = Number(selectedRefund.remainingRefundDue ?? selectedRefund.netRefundAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentFormError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (amountNum > remainingDue) {
      setPaymentFormError(`Amount of GH₵ ${amountNum.toLocaleString()} exceeds remaining balance of GH₵ ${remainingDue.toLocaleString()}.`);
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentFormError(null);

    try {
      const res = await apiRequest(`/refunds/${selectedRefund.id}/disburse`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountNum,
          paymentChannel,
          transactionReference: transactionReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
          disbursementDate: disbursementDate ? new Date(disbursementDate).toISOString() : undefined,
        }),
      });

      // Invalidate queries so inventory & refunds update immediately
      await queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['plots'] });
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });

      // Close Add Payment modal
      setIsAddPaymentModalOpen(false);

      // Automatically construct and open the Receipt Voucher for this newly made payment
      const newDisbursement = res?.disbursement || {
        refundDisbursementRef: `RFD-${new Date().toISOString().slice(0, 7).replace('-', '')}-NEW`,
        amount: amountNum,
        disbursementDate: disbursementDate,
        paymentChannel,
        transactionReference,
        notes: paymentNotes,
      };

      const updatedRemaining = res?.remainingRefundDue !== undefined ? res.remainingRefundDue : Math.max(0, remainingDue - amountNum);
      const updatedTotalPaid = Number(selectedRefund.totalRefundPaid || 0) + amountNum;

      setSelectedReceipt({
        disbursement: newDisbursement,
        refund: {
          ...selectedRefund,
          totalRefundPaid: updatedTotalPaid,
          remainingRefundDue: updatedRemaining,
          status: updatedRemaining === 0 ? 'FULLY_REFUNDED' : 'PARTIALLY_REFUNDED',
        },
        customer: selectedRefund.customer,
        plot: selectedRefund.plot,
      });

      setIsReceiptModalOpen(true);
    } catch (err: any) {
      setPaymentFormError(err?.message || 'Failed to record refund payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Dedicated Automated Sharp Headless PDF Download using jsPDF + html2canvas
  const handleDownloadPdf = async () => {
    if (!selectedReceipt) return;
    setIsExportingPdf(true);
    try {
      const el = document.getElementById('official-refund-receipt-voucher');
      if (!el) throw new Error('Receipt element not found.');

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('official-refund-receipt-voucher');
          if (target) {
            target.style.width = '794px';
            target.style.maxWidth = '794px';
            target.style.margin = '0 auto';
            target.style.padding = '24px';
            target.style.boxShadow = 'none';
            target.style.border = 'none';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const refNumber = selectedReceipt.disbursement?.refundDisbursementRef || 'VOUCHER';
      const custName = `${selectedReceipt.customer?.lastName || ''}_${selectedReceipt.customer?.firstName || ''}`;
      pdf.save(`Refund_Receipt_${refNumber}_${custName}.pdf`);
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('Could not generate PDF. Please use the Print Receipt button to print or save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Helper for dynamic remaining calculation in Add Payment Modal
  const modalCalculations = useMemo(() => {
    if (!selectedRefund) return { currentRemaining: 0, payVal: 0, newRemaining: 0, isFullSettlement: false, isOverpaying: false };
    const currentRemaining = Number(selectedRefund.remainingRefundDue ?? selectedRefund.netRefundAmount);
    const payVal = parseFloat(paymentAmountInput) || 0;
    const newRemaining = Math.max(0, currentRemaining - payVal);
    const isOverpaying = payVal > currentRemaining;
    const isFullSettlement = payVal > 0 && Math.abs(currentRemaining - payVal) < 0.01;

    return { currentRemaining, payVal, newRemaining, isFullSettlement, isOverpaying };
  }, [selectedRefund, paymentAmountInput]);

  return (
    <div className="space-y-6">
      {/* Print Stylesheet for Official Receipt */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-refund-receipt-voucher,
          #official-refund-receipt-voucher * {
            visibility: visible !important;
          }
          #official-refund-receipt-voucher {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .print-hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Refund Workflow</h1>
          <p className="text-xs text-slate-500 mt-1">
            Process customer refunds, manage disbursements, issue payment receipts, and track refund payment histories.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Refund Cases</span>
            <RotateCcw className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{stats.totalCount}</p>
          <span className="text-[10px] text-amber-600 font-semibold mt-0.5 block">
            {stats.pendingAudit} pending executive audit
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Approved</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatGHS(stats.totalApprovedNet)}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Authorized net refund obligations</span>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Disbursed</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">{formatGHS(stats.totalDisbursed)}</p>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Paid out to customers</span>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Remaining Balance</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-extrabold text-amber-800 mt-1">{formatGHS(stats.totalRemainingDue)}</p>
          <span className="text-[10px] text-amber-700 font-semibold mt-0.5 block">Pending disbursement</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client, refund #, or plot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Refunds' },
            { id: 'PENDING', label: 'Pending Audit' },
            { id: 'APPROVED', label: 'Approved (Unpaid)' },
            { id: 'PARTIALLY_REFUNDED', label: 'Partially Paid' },
            { id: 'FULLY_REFUNDED', label: 'Fully Paid' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Refunds Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <RotateCcw className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No matching refund applications</p>
            <p className="text-xs text-slate-400 mt-1">
              Customer refund requests will appear here for audit, disbursement, and receipt generation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Refund Ref</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Target Plot & Status</th>
                  <th className="py-3 px-3 text-right">Payments Received</th>
                  <th className="py-3 px-3 text-right">Deductions</th>
                  <th className="py-3 px-3 text-right">Net Approved</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-3 text-right">Remaining Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((r: any) => {
                  const isPendingMD = r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW';
                  const isApproved = r.status === 'APPROVED';
                  const isPartiallyPaid = r.status === 'PARTIALLY_REFUNDED';
                  const isFullyPaid = r.status === 'FULLY_REFUNDED';
                  const canAddPayment = isApproved || isPartiallyPaid;

                  const remainingBalance = Number(r.remainingRefundDue ?? r.netRefundAmount);
                  const totalPaid = Number(r.totalRefundPaid || 0);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold font-mono text-slate-900 whitespace-nowrap">
                        {r.refundNumber}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold block text-slate-800 whitespace-nowrap">
                          {r.customer?.firstName} {r.customer?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{r.customer?.customerNumber}</span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {r.plot?.plotNumber}
                          <span className="font-normal text-slate-500 text-[11px] block">
                            {r.plot?.landLocation?.name}
                          </span>
                        </div>
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                            <Check className="h-3 w-3 text-emerald-600" />
                            Restocked to Available Lands
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">
                            Quarantined
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatGHS(r.totalPaymentsReceived)}
                      </td>

                      <td className="py-3 px-3 text-right text-red-600 font-medium whitespace-nowrap">
                        -{formatGHS(r.totalDeductions)}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatGHS(r.netRefundAmount)}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {formatGHS(totalPaid)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-black ${remainingBalance === 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                        >
                          {formatGHS(remainingBalance)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPendingMD
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isApproved
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : isPartiallyPaid
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : isFullyPaid
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                        >
                          {r.status === 'FULLY_REFUNDED'
                            ? 'FULLY PAID'
                            : r.status === 'PARTIALLY_REFUNDED'
                              ? 'PARTIALLY PAID'
                              : r.status === 'APPROVED'
                                ? 'APPROVED (UNPAID)'
                                : r.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Review & Audit Button for MD */}
                          {isPendingMD && hasRole(['MANAGING_DIRECTOR', 'SUPER_ADMINISTRATOR']) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRefund(r);
                                setIsApprovalModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Review & Audit
                            </button>
                          )}

                          {/* Add Payment Button */}
                          {canAddPayment && hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']) && (
                            <button
                              type="button"
                              onClick={() => handleOpenAddPayment(r)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1"
                              title="Enter amount being paid to customer and issue receipt"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              Add Payment
                            </button>
                          )}

                          {/* Payment History Button */}
                          {(r.refundDisbursements?.length > 0 || isApproved || isPartiallyPaid || isFullyPaid) && (
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(r)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs cursor-pointer border border-slate-300 flex items-center gap-1"
                              title="View and print refund payment history"
                            >
                              <History className="h-3.5 w-3.5 text-slate-600" />
                              Payment History
                            </button>
                          )}

                          {/* Delete Refund Request Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setRefundToDelete(r);
                              setDeleteRefundError(null);
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                            title="Delete refund request"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* MODAL 1: ADD PAYMENT / DISBURSEMENT */}
      {isAddPaymentModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Customer Refund Payment</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedRefund.refundNumber} — {selectedRefund.customer?.firstName} {selectedRefund.customer?.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {paymentFormError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{paymentFormError}</span>
              </div>
            )}

            {/* Financial Status Summary Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Net Approved</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    {formatGHS(selectedRefund.netRefundAmount)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Paid Prior</span>
                  <span className="font-bold text-emerald-700 text-xs mt-0.5 block">
                    {formatGHS(selectedRefund.totalRefundPaid || 0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">Current Remaining</span>
                  <span className="font-black text-amber-800 text-xs mt-0.5 block">
                    {formatGHS(modalCalculations.currentRemaining)}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddPaymentSubmit} className="mt-4 space-y-4 text-xs">
              {/* Payment Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Amount Being Paid to Customer (GH₵) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput(String(modalCalculations.currentRemaining))}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                    >
                      Pay Full Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput(String(Math.round((modalCalculations.currentRemaining / 2) * 100) / 100))}
                      className="text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                    >
                      50% Balance
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">GH₵</span>
                  <input
                    type="number"
                    min="1"
                    max={modalCalculations.currentRemaining}
                    step="0.01"
                    required
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    placeholder="Enter amount to disburse"
                    className="w-full pl-12 pr-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Remaining Balance Indicator */}
              <div
                className={`p-3 rounded-xl border transition-all ${modalCalculations.isOverpaying
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : modalCalculations.isFullSettlement
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">
                    Remaining Balance After This Payment:
                  </span>
                  <span
                    className={`font-black text-sm font-mono ${modalCalculations.newRemaining === 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                  >
                    {formatGHS(modalCalculations.newRemaining)}
                  </span>
                </div>

                {modalCalculations.isFullSettlement && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-1.5 font-medium leading-relaxed">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>100% Full Payout:</strong> Upon confirming this payment, the allocated land plot (
                      <strong>{selectedRefund.plot?.plotNumber}</strong>) will automatically be restored to{' '}
                      <strong className="text-emerald-950 underline">AVAILABLE</strong> status in inventory so a new customer can buy it immediately.
                    </span>
                  </div>
                )}

                {modalCalculations.isOverpaying && (
                  <p className="mt-1 text-[11px] text-red-600 font-bold">
                    Warning: Amount exceeds total remaining refund balance.
                  </p>
                )}
              </div>

              {/* Disbursement Channel & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Channel *</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="BANK_DIRECT_DEPOSIT">Bank Direct Deposit</option>
                    <option value="MOBILE_MONEY_MTN">MTN Mobile Money</option>
                    <option value="MOBILE_MONEY_TELECEL">Telecel Cash</option>
                    <option value="CASH">Cash Office Payout</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Date *</label>
                  <input
                    type="date"
                    required
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  External Reference / Cheque # (Optional)
                </label>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="e.g. MoMo Ref #, Cheque #, or Wire Slip Number"
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Tranche 1 refund payout per settlement agreement"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || modalCalculations.isOverpaying || modalCalculations.payVal <= 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? (
                    'Recording Payment...'
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Add Payment & Issue Receipt
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOMER REFUND PAYMENT HISTORY */}
      {isHistoryModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Customer Refund Payment History</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedRefund.refundNumber} — {selectedRefund.customer?.firstName} {selectedRefund.customer?.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Net Approved</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                  {formatGHS(selectedRefund.netRefundAmount)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-semibold uppercase block">Total Disbursed</span>
                <span className="font-bold text-emerald-700 text-xs mt-0.5 block">
                  {formatGHS(selectedRefund.totalRefundPaid || 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">Remaining Due</span>
                <span className="font-black text-amber-800 text-xs mt-0.5 block">
                  {formatGHS(selectedRefund.remainingRefundDue ?? selectedRefund.netRefundAmount)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Land Restock</span>
                {Number(selectedRefund.remainingRefundDue) === 0 ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded mt-0.5">
                    Available in Inventory
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded mt-0.5">
                    Quarantined
                  </span>
                )}
              </div>
            </div>

            {/* Disbursement Tranches Table */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Disbursement Tranches</h4>
                <span className="text-xs text-slate-500">
                  {selectedRefund.refundDisbursements?.length || 0} payment(s) recorded
                </span>
              </div>

              {!selectedRefund.refundDisbursements || selectedRefund.refundDisbursements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  <CreditCard className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                  <p className="text-xs font-semibold">No payments have been disbursed yet for this refund.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Payment" to record the first payout tranche.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Voucher Ref</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Channel & Ref</th>
                        <th className="py-2.5 px-3 text-right">Amount Paid</th>
                        <th className="py-2.5 px-3 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRefund.refundDisbursements.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold font-mono text-slate-900">
                            {d.refundDisbursementRef}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {new Date(d.disbursementDate).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-800 block">
                              {d.paymentChannel.replace(/_/g, ' ')}
                            </span>
                            {d.transactionReference && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Ref: {d.transactionReference}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                            {formatGHS(d.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(selectedRefund, d)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] cursor-pointer flex items-center gap-1 mx-auto"
                            >
                              <Printer className="h-3 w-3" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
              {Number(selectedRefund.remainingRefundDue ?? selectedRefund.netRefundAmount) > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryModalOpen(false);
                    handleOpenAddPayment(selectedRefund);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Another Payment
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Fully Refunded & Settled
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OFFICIAL CUSTOMER REFUND PAYMENT RECEIPT VOUCHER */}
      {isReceiptModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            {/* Modal Bar: Actions & Close (hidden on paper printout) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 print-hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Official Customer Refund Payment Receipt</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isExportingPdf ? 'Exporting...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE OFFICIAL RECEIPT VOUCHER CANVAS */}
            <div
              id="official-refund-receipt-voucher"
              className="bg-white p-6 rounded-xl border border-slate-300 space-y-4 text-xs font-sans text-slate-900"
            >
              {/* Letterhead */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-slate-950 leading-tight">
                    {settings?.companyName || 'POTENTIAL INVESTMENT REAL ESTATE LTD.'}
                  </h2>
                  <p className="text-xs text-slate-700 font-semibold leading-tight mt-0.5">
                    Corporate Head Office: {settings?.companyAddress || 'Ashaiman New Tulaku, Adjacent to New Tulaku Police Station.'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tel: {settings?.companyPhone || '0541196364'} | Email: {settings?.companyEmail || 'potentialrealestate04@gmail.com'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1.5 bg-slate-900 text-white font-mono font-bold text-sm rounded shadow-sm">
                    {selectedReceipt.disbursement?.refundDisbursementRef}
                  </span>
                  <p className="text-[11px] text-slate-700 font-semibold mt-1 font-mono">
                    Ref: {selectedReceipt.refund?.refundNumber}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Disbursed:{' '}
                    {new Date(
                      selectedReceipt.disbursement?.disbursementDate || Date.now(),
                    ).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Title Banner */}
              <div className="text-center py-2 px-3 bg-slate-100 rounded-lg border-y-2 border-slate-900">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  OFFICIAL CUSTOMER REFUND PAYMENT VOUCHER
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Corporate Cashier & Accounts Payout Receipt for Contractual Land Refund
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-300 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Beneficiary Customer (Payee):
                  </span>
                  <strong className="text-slate-950 text-sm block">
                    {selectedReceipt.customer?.firstName} {selectedReceipt.customer?.lastName}
                  </strong>
                  <span className="text-slate-600 block text-[11px]">
                    Customer ID: <strong className="font-mono text-slate-900">{selectedReceipt.customer?.customerNumber}</strong>
                  </span>
                  <span className="text-slate-600 block text-[11px]">
                    Telephone: <strong className="text-slate-900">{selectedReceipt.customer?.telephone}</strong>
                  </span>
                  {selectedReceipt.customer?.residentialAddress && (
                    <span className="text-slate-600 block text-[11px]">
                      Address: <strong className="text-slate-900">{selectedReceipt.customer?.residentialAddress}</strong>
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Quarantined / Relinquished Parcel:
                  </span>
                  <strong className="text-slate-950 text-sm block">
                    Plot {selectedReceipt.plot?.plotNumber}
                  </strong>
                  <span className="text-slate-600 block text-[11px]">
                    Site Location: <strong className="text-slate-900">{selectedReceipt.plot?.landLocation?.name}</strong>
                  </span>
                  <span className="text-slate-600 block text-[11px]">
                    Disbursement Channel: <strong className="text-slate-900">{selectedReceipt.disbursement?.paymentChannel?.replace(/_/g, ' ')}</strong>
                  </span>
                  {selectedReceipt.disbursement?.transactionReference && (
                    <span className="text-slate-600 block text-[11px] font-mono">
                      Transaction Ref: <strong>{selectedReceipt.disbursement.transactionReference}</strong>
                    </span>
                  )}
                  {Number(selectedReceipt.refund?.remainingRefundDue) === 0 ? (
                    <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 mt-1">
                      ✓ Land Plot Restocked to Available Inventory
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 mt-1">
                      Plot Quarantined (Settlement In Progress)
                    </span>
                  )}
                </div>
              </div>

              {/* Amount Highlight Box */}
              <div
                className="rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm border border-slate-800"
                style={{ padding: '20px 24px', minHeight: '84px', boxSizing: 'border-box' }}
              >
                <div className="space-y-1">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                    Amount Disbursed in Figures
                  </span>
                  <p
                    className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight"
                    style={{ lineHeight: '1.25', margin: 0, padding: 0 }}
                  >
                    {formatGHS(selectedReceipt.disbursement?.amount || 0)}
                  </p>
                </div>
                <div className="text-right max-w-xs sm:max-w-md space-y-1">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                    Amount Disbursed in Words
                  </span>
                  <p
                    className="text-xs sm:text-sm font-semibold text-slate-200 italic leading-relaxed"
                    style={{ margin: 0, padding: 0 }}
                  >
                    {numberToGhanaCedisWords(Number(selectedReceipt.disbursement?.amount || 0))}
                  </p>
                </div>
              </div>

              {/* Financial Position Ledger Table */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 block">
                  Refund Account Financial Position
                </span>
                <div className="rounded-xl border border-slate-300 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Net Approved Refund</th>
                        <th className="p-2">Total Paid to Date</th>
                        <th className="p-2">This Disbursement</th>
                        <th className="p-2 text-right">Remaining Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      <tr>
                        <td className="p-2 font-semibold text-slate-900">
                          {formatGHS(selectedReceipt.refund?.netRefundAmount || 0)}
                        </td>
                        <td className="p-2 text-slate-700 font-medium">
                          {formatGHS(selectedReceipt.refund?.totalRefundPaid || 0)}
                        </td>
                        <td className="p-2 font-black text-emerald-700">
                          {formatGHS(selectedReceipt.disbursement?.amount || 0)}
                        </td>
                        <td className="p-2 text-right font-black text-amber-700">
                          {formatGHS(selectedReceipt.refund?.remainingRefundDue ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="space-y-2 pt-3 border-t-2 border-slate-900">
                <div className="grid grid-cols-2 gap-6 text-xs">
                  {/* Pod 1: Customer Signature */}
                  <div
                    className="p-3.5 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[140px]"
                    style={{ overflow: 'visible' }}
                  >
                    <span className="font-bold text-[11px] uppercase text-slate-900 border-b border-slate-200 pb-1 text-center block tracking-wide">
                      Beneficiary Customer Acknowledgement
                    </span>
                    <div className="py-2.5 border-b border-dashed border-slate-400 text-center text-slate-400 text-[10px]">
                      Authorized Signature
                    </div>
                    <div className="space-y-1 text-xs text-slate-700 pt-1" style={{ overflow: 'visible' }}>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Name: <strong className="text-slate-950 font-bold">{selectedReceipt.customer?.firstName} {selectedReceipt.customer?.lastName}</strong>
                      </p>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Date: _____ / _____ / 20____
                      </p>
                    </div>
                  </div>

                  {/* Pod 2: Authorized Cashier / Accountant */}
                  <div
                    className="p-3.5 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[140px]"
                    style={{ overflow: 'visible' }}
                  >
                    <span className="font-bold text-[11px] uppercase text-slate-900 border-b border-slate-200 pb-1 text-center block tracking-wide">
                      Authorized Accounts Officer / Cashier
                    </span>
                    <div className="py-2.5 border-b border-dashed border-slate-400 text-center text-slate-400 text-[10px]">
                      Cashier Verification & Corporate Seal
                    </div>
                    <div className="space-y-1 text-xs text-slate-700 pt-1" style={{ overflow: 'visible' }}>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Officer: <strong className="text-slate-950 font-bold">{user?.firstName ? `${user.firstName} ${user.lastName}` : 'Finance Officer'}</strong>
                      </p>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Date: {new Date(selectedReceipt.disbursement?.disbursementDate || Date.now()).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center italic mt-2">
                  This voucher serves as statutory proof of contractual refund disbursement issued by Potential Investment Real Estate Ltd.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MD APPROVAL GATE */}
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

            {approvalFormError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {approvalFormError}
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
                    <span className="font-bold text-emerald-700">Approve Application</span>
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
                <div className="space-y-3 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <span className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                      Established Refund Calculation
                    </span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded font-semibold">
                      Deduction Already Completed
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Payments Received:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatGHS(selectedRefund.totalPaymentsReceived)}
                      </span>
                    </div>

                    <div className="flex justify-between text-amber-700">
                      <span>Total Agreed Deductions:</span>
                      <span className="font-semibold font-mono">
                        - {formatGHS(selectedRefund.totalDeductions || selectedRefund.proposedDeductions || 0)}
                      </span>
                    </div>

                    {selectedRefund.deductions && selectedRefund.deductions.length > 0 && (
                      <div className="pl-2 border-l-2 border-emerald-300 text-[11px] text-slate-500 space-y-0.5 pt-0.5">
                        {selectedRefund.deductions.map((d: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {d.deductionName}:</span>
                            <span className="font-mono">{formatGHS(d.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-emerald-200 flex justify-between items-center">
                    <span className="font-bold text-xs text-emerald-950">Net Refund Payable to Client:</span>
                    <span className="text-base font-extrabold text-emerald-800 font-mono">
                      {formatGHS(
                        selectedRefund.netRefundAmount ||
                        Math.max(
                          0,
                          Number(selectedRefund.totalPaymentsReceived) -
                          Number(selectedRefund.totalDeductions || selectedRefund.proposedDeductions || 0),
                        ),
                      )}
                    </span>
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Executive Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="e.g. Approved for disbursement per statutory terms."
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Formal Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="State justification according to contractual terms..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:border-red-500 focus:outline-none"
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
                  disabled={isSubmittingApproval}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApproval ? 'Submitting...' : 'Authorize Executive Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 5: DELETE REFUND REQUEST CONFIRMATION */}
      {refundToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Refund Request?</h3>
                <p className="text-xs text-slate-500 font-mono">{refundToDelete.refundNumber}</p>
              </div>
            </div>

            {deleteRefundError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{deleteRefundError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete refund request <strong className="text-slate-900">{refundToDelete.refundNumber}</strong> for <strong className="text-slate-900">{refundToDelete.customer?.firstName} {refundToDelete.customer?.lastName}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1 mb-5">
              <p className="font-semibold">Automated Inventory Restocking:</p>
              <p className="text-[11px] text-amber-700">
                Any physical parcel allocated to this refund will automatically be restored to <strong>AVAILABLE</strong> inventory in its exact land location.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setRefundToDelete(null)}
                disabled={isDeletingRefund}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRefund}
                disabled={isDeletingRefund}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-sm transition flex items-center gap-1.5"
              >
                {isDeletingRefund ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
