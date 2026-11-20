'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Edit,
  Share2,
  Calendar,
  MessageSquare,
  Mail,
  User,
  Check,
  Tag,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react';

// Number to words converter for Ghanaian Currency receipts
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

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Record Form State
  const [allocationId, setAllocationId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('CASH');
  const [paymentCategory, setPaymentCategory] = useState('INSTALMENT');
  const [externalReference, setExternalReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Edit Form State
  const [editPaymentId, setEditPaymentId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentChannel, setEditPaymentChannel] = useState('MOBILE_MONEY_MTN');
  const [editPaymentCategory, setEditPaymentCategory] = useState('INSTALMENT');
  const [editExternalReference, setEditExternalReference] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankBranch, setEditBankBranch] = useState('');
  const [editChequeNumber, setEditChequeNumber] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Fetch Customers with their Financial Ledgers & Allocations
  const { data: customersData, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['customers', customerSearchTerm],
    queryFn: () =>
      apiRequest('/customers', {
        params: { search: customerSearchTerm || undefined, limit: 100 },
      }),
  });

  const rawCustomers = customersData?.data || customersData?.customers || [];

  // Filter customers by search term
  const customers = useMemo(() => {
    if (!customerSearchTerm.trim()) return rawCustomers;
    const q = customerSearchTerm.toLowerCase().trim();
    return rawCustomers.filter((c: any) => {
      const matchName = (c.fullName || '').toLowerCase().includes(q);
      const matchNumber = (c.customerNumber || '').toLowerCase().includes(q);
      const matchLoc = (c.primaryLocation || '').toLowerCase().includes(q) || (c.allLocations || '').toLowerCase().includes(q);
      const matchPhone = (c.telephone || '').includes(q);
      const matchPlot = c.plotNumbers?.some((p: string) => p.toLowerCase().includes(q));
      return matchName || matchNumber || matchLoc || matchPhone || matchPlot;
    });
  }, [rawCustomers, customerSearchTerm]);

  // 2. Fetch Active Allocations for Payment Recording
  const { data: activeAllocations = [] } = useQuery({
    queryKey: ['active-allocations'],
    queryFn: () => apiRequest('/payments/active-allocations'),
    enabled: isRecordModalOpen,
  });

  // Calculate high-level financial portfolio totals
  const portfolioStats = useMemo(() => {
    let totalAgreed = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    customers.forEach((c: any) => {
      totalAgreed += Number(c.financials?.totalAgreedPrice || c.ledger?.totalAgreedPrice || 0);
      totalPaid += Number(c.financials?.totalAmountPaid || c.ledger?.totalAmountPaid || 0);
      totalOutstanding += Number(c.financials?.outstandingBalance || c.ledger?.totalOutstandingBalance || 0);
    });

    const recoveryRate = totalAgreed > 0 ? (totalPaid / totalAgreed) * 100 : 0;
    return { totalAgreed, totalPaid, totalOutstanding, recoveryRate };
  }, [customers]);

  const selectedAlloc = activeAllocations.find((a: any) => a.id === allocationId);

  const resetForm = () => {
    setAllocationId('');
    setAmount('');
    setPaymentChannel('CASH');
    setPaymentCategory('INSTALMENT');
    setExternalReference('');
    setBankName('');
    setBankBranch('');
    setChequeNumber('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError(null);
  };

  // Open Record Modal pre-filled for a specific customer allocation
  const handleOpenRecordModalForCustomer = (allocId?: string) => {
    resetForm();
    if (allocId) {
      setAllocationId(allocId);
    }
    setIsRecordModalOpen(true);
  };

  // Open Edit Payment Modal
  const handleOpenEditPayment = (p: any) => {
    setEditingPayment(p);
    setEditPaymentId(p.id);
    setEditAmount(String(p.amount || ''));
    setEditPaymentChannel(p.paymentChannel || 'MOBILE_MONEY_MTN');
    setEditPaymentCategory(p.paymentCategory || 'INSTALMENT');
    setEditExternalReference(p.externalGatewayRef || '');
    setEditBankName(p.bankName || '');
    setEditBankBranch(p.bankBranch || '');
    setEditChequeNumber(p.chequeNumber || '');
    setEditPaymentDate(p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : '');
    setEditNotes(p.notes || '');
    setFormError(null);
    setSuccessMsg(null);
    setIsEditModalOpen(true);
  };

  // Submit Record Payment
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationId) {
      setFormError('Please select a customer plot allocation.');
      return;
    }
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
          externalGatewayRef: externalReference.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankBranch: bankBranch.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          paymentDate: paymentDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      setIsRecordModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['active-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      // Automatically show generated receipt
      if (res?.receipt || res?.payment) {
        setSelectedReceipt({
          receiptNumber: res.receipt?.receiptNumber || `RCT-${res.payment?.transactionReference?.replace(/^TXN-|^PAY-/, '')}`,
          payment: res.payment,
          customer: res.payment?.customer || selectedAlloc?.customer,
          allocation: res.payment?.allocation || selectedAlloc,
          amountReceived: Number(amount),
          outstandingBalanceAfter: res.outstandingBalance !== undefined ? res.outstandingBalance : selectedAlloc?.outstandingBalance,
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record customer payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Payment
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/payments/${editPaymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: Number(editAmount),
          paymentChannel: editPaymentChannel,
          paymentCategory: editPaymentCategory,
          externalGatewayRef: editExternalReference.trim() || undefined,
          bankName: editBankName.trim() || undefined,
          bankBranch: editBankBranch.trim() || undefined,
          chequeNumber: editChequeNumber.trim() || undefined,
          paymentDate: editPaymentDate || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });

      setSuccessMsg('Payment transaction updated and customer balance adjusted.');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['active-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      setTimeout(() => {
        setIsEditModalOpen(false);
        setSuccessMsg(null);
      }, 900);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update payment transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Channel Badge Formatter
  const getChannelBadge = (ch: string) => {
    if (ch?.includes('MOBILE_MONEY') || ch === 'MOBILE_MONEY') {
      const net = ch.includes('MTN') ? 'MTN MoMo' : ch.includes('TELECEL') ? 'Telecel Cash' : ch.includes('AT') ? 'AT Money' : 'Mobile Money';
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Smartphone className="h-3 w-3" />
          <span>{net}</span>
        </span>
      );
    }
    if (ch?.includes('BANK')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Building className="h-3 w-3" />
          <span>Bank Transfer</span>
        </span>
      );
    }
    if (ch === 'CASH') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Coins className="h-3 w-3" />
          <span>Direct Cash</span>
        </span>
      );
    }
    if (ch === 'CHEQUE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <FileText className="h-3 w-3" />
          <span>Cheque Deposit</span>
        </span>
      );
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{ch}</span>;
  };

  // Send Receipt via WhatsApp
  const handleSendReceiptWhatsApp = (receipt: any) => {
    const cust = receipt.customer || receipt.payment?.customer;
    const phone = (cust?.telephone || '').replace(/[\s\-\(\)\+]/g, '');
    const intlPhone = phone.startsWith('0') ? `233${phone.slice(1)}` : phone.startsWith('233') ? phone : `233${phone}`;

    const rctNum = receipt.receiptNumber || `RCT-${receipt.payment?.transactionReference?.replace(/^TXN-|^PAY-/, '')}`;
    const amountStr = formatGHS(receipt.amountReceived || receipt.payment?.amount || 0);
    const balanceStr = formatGHS(receipt.outstandingBalanceAfter !== undefined ? receipt.outstandingBalanceAfter : receipt.payment?.allocation?.outstandingBalance || 0);
    const plotNumber = receipt.allocation?.plot?.plotNumber || receipt.payment?.allocation?.plot?.plotNumber || 'Assigned Plot';
    const locName = receipt.allocation?.plot?.landLocation?.name || receipt.payment?.allocation?.plot?.landLocation?.name || 'Registered Site';

    const message = `*POTENTIAL INVESTMENT REAL ESTATE LTD.*
_Official Payment Receipt_

Dear *${cust?.firstName} ${cust?.lastName}*,

We have received your payment. Here are your official payment receipt details:

🧾 *Receipt Number:* ${rctNum}
💰 *Amount Received:* ${amountStr}
📍 *Land Location:* ${locName}
🗺️ *Plot Number:* ${plotNumber}
⏳ *Remaining Balance:* ${balanceStr}

Your official receipt has been issued and archived on our system. Thank you for your continued partnership!
📞 Tel: 0541196364 | ✉️ potentialrealestate04@gmail.com | 📍 Ashaiman New Tulaku, Adjacent to New Tulaku Police Station`;

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Dedicated Automated Ultra-Sharp Headless PDF Download using jsPDF + html2canvas (Lossless PNG @ 336 DPI)
  const handleDownloadPdf = async (receipt: any) => {
    if (!receipt) return;
    setIsExportingPdf(true);
    try {
      const el = document.getElementById('official-payment-receipt-voucher');
      if (!el) {
        throw new Error('Official receipt element not found.');
      }

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      // High-resolution rendering: scale 3.5 gives ~336 DPI for crisp text & borders
      const canvas = await html2canvas(el, {
        scale: 3.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('official-payment-receipt-voucher');
          if (target) {
            target.style.width = '794px';
            target.style.maxWidth = '794px';
            target.style.height = 'auto';
            target.style.minHeight = 'auto';
            target.style.maxHeight = 'none';
            target.style.overflow = 'visible';
            target.style.boxShadow = 'none';
            target.style.margin = '0 auto';
            (target.style as any).webkitFontSmoothing = 'antialiased';
            (target.style as any).textRendering = 'geometricPrecision';

            let parent = target.parentElement;
            while (parent) {
              parent.style.height = 'auto';
              parent.style.maxHeight = 'none';
              parent.style.overflow = 'visible';
              parent = parent.parentElement;
            }
          }
        },
      });

      // Lossless PNG format ensures pixel-perfect sharp text without JPEG DCT compression fuzziness
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const pageUsableHeight = pdfHeight - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      if (contentHeight <= pageUsableHeight) {
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
      } else {
        const pxPerPage = Math.floor((canvas.width * pageUsableHeight) / contentWidth);
        const totalPages = Math.ceil(canvas.height / pxPerPage);

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          const sY = i * pxPerPage;
          const sH = Math.min(pxPerPage, canvas.height - sY);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sH;
          const pCtx = pageCanvas.getContext('2d');
          if (pCtx) {
            pCtx.fillStyle = '#ffffff';
            pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pCtx.drawImage(canvas, 0, sY, canvas.width, sH, 0, 0, pageCanvas.width, sH);
            const pageImgData = pageCanvas.toDataURL('image/png');
            const pageRenderHeight = (sH * contentWidth) / canvas.width;
            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageRenderHeight, undefined, 'FAST');
          }
        }
      }

      const receiptRef = receipt.receiptNumber || receipt.transactionReference || 'Payment_Receipt';
      const filename = `Receipt_${receiptRef.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      console.error('Headless PDF export error:', err);
      alert('Could not export PDF directly. Please use the Print button to Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Payments & Collections</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer financial accounts, record payments via Mobile Money, Bank Transfer, or Cash, edit transactions, and print official PDF receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenRecordModalForCustomer()}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Record Customer Payment</span>
        </button>
      </div>

      {/* Top Financial Portfolio Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Contract Value</span>
          <p className="text-xl font-black text-slate-900 mt-1">{formatGHS(portfolioStats.totalAgreed)}</p>
          <span className="text-[11px] text-slate-400">Total agreed consideration</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Collections Received</span>
          <p className="text-xl font-black text-emerald-700 mt-1">{formatGHS(portfolioStats.totalPaid)}</p>
          <span className="text-[11px] text-emerald-600">All customer payments collected</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Outstanding Balance Due</span>
          <p className="text-xl font-black text-amber-700 mt-1">{formatGHS(portfolioStats.totalOutstanding)}</p>
          <span className="text-[11px] text-amber-600">Remaining to collect</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collection Rate</span>
          <p className="text-xl font-black text-slate-900 mt-1">{portfolioStats.recoveryRate.toFixed(1)}%</p>
          <span className="text-[11px] text-slate-400">Of total portfolio paid</span>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex border-b border-slate-200">
        <div className="pb-3 px-2 text-xs font-bold border-b-2 border-emerald-600 text-emerald-800">
          Customer Financial Accounts & Ledgers ({customers.length})
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CUSTOMER FINANCIAL ACCOUNTS & LEDGERS */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Customer Search Bar */}
        <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={customerSearchTerm}
            onChange={(e) => setCustomerSearchTerm(e.target.value)}
            placeholder="Search customers by name, land location, phone number, or Customer ID..."
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
          />
          {customerSearchTerm && (
            <button
              onClick={() => setCustomerSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Customers Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {isCustomersLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <User className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No customer financial records found</p>
              <p className="text-xs text-slate-400 mt-1">Enroll customers and allocate plots to view their ledgers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Land Location & Plot(s)</th>
                    <th className="py-3 px-4">Payment Plan</th>
                    <th className="py-3 px-4 text-right">Total Agreed</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c: any) => {
                    const agreed = Number(c.financials?.totalAgreedPrice || c.ledger?.totalAgreedPrice || 0);
                    const paid = Number(c.financials?.totalAmountPaid || c.ledger?.totalAmountPaid || 0);
                    const balance = Number(c.financials?.outstandingBalance || c.ledger?.totalOutstandingBalance || 0);
                    const isFullyPaid = agreed > 0 && balance === 0;

                    // Find primary allocation ID for quick payment recording
                    const primaryAllocId = c.allocations?.[0]?.id;
                    const customerPayments = c.payments || [];
                    const isExpanded = expandedCustomerId === c.id;

                    return (
                      <React.Fragment key={c.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-emerald-50/20' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setExpandedCustomerId(isExpanded ? null : c.id)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                                title={isExpanded ? 'Collapse payments' : 'View payment receipts'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <div>
                                <span className="font-bold text-slate-900 block">{c.fullName || `${c.firstName} ${c.lastName}`}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{c.customerNumber}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <span>{c.telephone}</span>
                            {c.email && <span className="block text-[10px] text-slate-400">{c.email}</span>}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{c.primaryLocation || c.allLocations || 'General'}</span>
                            {c.plotNumbers && c.plotNumbers.length > 0 && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {c.plotNumbers.join(', ')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                              {c.paymentTerm || 'Outright'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-slate-900">{formatGHS(agreed)}</td>

                          <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatGHS(paid)}</td>

                          <td className="py-3 px-4 text-right font-bold text-amber-600">{formatGHS(balance)}</td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center space-x-1.5">
                              {balance > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecordModalForCustomer(primaryAllocId)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center space-x-1"
                                  title="Record payment via Mobile Money, Bank Transfer, or Cash"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Add Payment</span>
                                </button>
                              ) : isFullyPaid ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="h-3 w-3 mr-1" />
                                  <span>Paid in Full</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecordModalForCustomer(primaryAllocId)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                                >
                                  Add Payment
                                </button>
                              )}

                              {customerPayments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCustomerId(isExpanded ? null : c.id)}
                                  className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center space-x-1"
                                  title="View receipts & edit payments"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Receipts ({customerPayments.length})</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Customer Payments Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-y border-emerald-200">
                            <td colSpan={8} className="p-4">
                              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <CreditCard className="h-4 w-4 text-emerald-600" />
                                    <h4 className="font-bold text-slate-900 text-xs">
                                      Payment Records & Official Receipts for {c.fullName}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      {customerPayments.length} Transaction{customerPayments.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecordModalForCustomer(primaryAllocId)}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Record Another Payment</span>
                                  </button>
                                </div>

                                {customerPayments.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-3 text-center">
                                    No payments logged for this customer yet. Click "Add Payment" above to record an installment, deposit, or full payment.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                        <tr>
                                          <th className="py-2 px-3">Receipt #</th>
                                          <th className="py-2 px-3">Date</th>
                                          <th className="py-2 px-3">Category</th>
                                          <th className="py-2 px-3">Channel</th>
                                          <th className="py-2 px-3">Ref ID</th>
                                          <th className="py-2 px-3 text-right">Amount Paid</th>
                                          <th className="py-2 px-3 text-center">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {customerPayments.map((p: any) => {
                                          const rctNumber = p.receipt?.receiptNumber || `RCT-${p.transactionReference?.replace(/^TXN-|^PAY-/, '')}`;
                                          return (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                                {rctNumber}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600">
                                                {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-slate-700">
                                                {p.paymentCategory?.replace(/_/g, ' ') || 'Instalment'}
                                              </td>
                                              <td className="py-2 px-3">
                                                {getChannelBadge(p.paymentChannel)}
                                              </td>
                                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                                {p.externalGatewayRef || p.transactionReference}
                                              </td>
                                              <td className="py-2 px-3 text-right font-black text-emerald-700">
                                                {formatGHS(p.amount)}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <div className="inline-flex items-center space-x-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditPayment({ ...p, customer: c })}
                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                                    title="Edit this payment record"
                                                  >
                                                    <Edit className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setSelectedReceipt({
                                                        receiptNumber: rctNumber,
                                                        payment: p,
                                                        customer: c,
                                                        allocation: p.allocation || c.allocations?.[0],
                                                        amountReceived: Number(p.amount),
                                                        outstandingBalanceAfter: p.receipt?.outstandingBalanceAfter !== undefined ? p.receipt.outstandingBalanceAfter : p.allocation?.outstandingBalance,
                                                      })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition cursor-pointer flex items-center space-x-1 text-xs"
                                                    title="Print or Save PDF Receipt"
                                                  >
                                                    <Printer className="h-3.5 w-3.5" />
                                                    <span>Print / PDF Receipt</span>
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RECORD PAYMENT MODAL (MOBILE MONEY / BANK TRANSFER / CASH) */}
      {/* ========================================================================= */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  <span>Record Customer Payment</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Log deposit, installment, or outright settlement with automated PDF receipt generation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close modal"
                aria-label="Close"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Allocation Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer & Plot Allocation *</label>
                <select
                  required
                  value={allocationId}
                  onChange={(e) => setAllocationId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="">-- Select Customer Plot Account --</option>
                  {activeAllocations.map((alloc: any) => (
                    <option key={alloc.id} value={alloc.id}>
                      {alloc.customer?.firstName} {alloc.customer?.lastName} ({alloc.customer?.customerNumber}) — {alloc.plot?.plotNumber} ({alloc.plot?.landLocation?.name}) — Bal: {formatGHS(alloc.outstandingBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Allocation Info Pill */}
              {selectedAlloc && (
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Agreed Price</span>
                    <strong className="text-slate-900 text-xs">{formatGHS(selectedAlloc.agreedPrice)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Total Paid So Far</span>
                    <strong className="text-emerald-700 text-xs">{formatGHS(selectedAlloc.totalAmountPaid)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Balance Outstanding</span>
                    <strong className="text-amber-700 text-xs">{formatGHS(selectedAlloc.outstandingBalance)}</strong>
                  </div>
                </div>
              )}

              {/* Amount & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Paid (GH₵) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:outline-none font-mono text-sm font-bold text-slate-900"
                    />
                    {selectedAlloc && Number(selectedAlloc.outstandingBalance) > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(selectedAlloc.outstandingBalance))}
                        className="absolute right-2 top-2 px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold"
                      >
                        Full Bal
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Category</label>
                  <select
                    value={paymentCategory}
                    onChange={(e) => setPaymentCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="INITIAL_DEPOSIT">Initial Deposit</option>
                    <option value="INSTALMENT">Instalment Payment</option>
                    <option value="FULL_OUTRIGHT">Full Outright Payment</option>
                    <option value="RESERVATION_FEE">Reservation Fee</option>
                  </select>
                </div>
              </div>

              {/* Payment Channel: Mobile Money / Bank Transfer / Cash */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Payment Channel *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'MOBILE_MONEY_MTN', label: 'MTN Mobile Money' },
                    { id: 'MOBILE_MONEY_TELECEL', label: 'Telecel Cash' },
                    { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
                    { id: 'CASH', label: 'Cash (Office)' },
                    { id: 'CHEQUE', label: 'Bank Cheque' },
                    { id: 'MOBILE_MONEY_AT', label: 'AT Money' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setPaymentChannel(ch.id)}
                      className={`p-2 rounded-lg border text-left text-xs transition cursor-pointer ${paymentChannel === ch.id
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel specific fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Reference (MoMo ID / Bank Ref)
                  </label>
                  <input
                    type="text"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="e.g. MTN-9840192842 or Slip #0492"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bank fields (if Bank Transfer or Cheque) */}
              {(paymentChannel === 'BANK_TRANSFER' || paymentChannel === 'CHEQUE') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. GCB Bank / Stanbic"
                      className="w-full p-2 text-xs rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Branch</label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      placeholder="e.g. High Street"
                      className="w-full p-2 text-xs rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. CHQ-984012"
                      className="w-full p-2 text-xs rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received at Accra Head Office"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Recording Payment...' : 'Record Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EDIT PAYMENT MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Edit className="h-5 w-5 text-amber-400" />
                  <span>Edit Payment Record</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Update payment amount, channel, reference, or date. Balances adjust automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close modal"
                aria-label="Close"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMsg && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Linked Customer & Parcel</span>
                <p className="font-bold text-slate-900">
                  {editingPayment?.customer?.firstName} {editingPayment?.customer?.lastName} ({editingPayment?.customer?.customerNumber})
                </p>
                <p className="text-slate-600">
                  {editingPayment?.allocation?.plot?.plotNumber} — {editingPayment?.allocation?.plot?.landLocation?.name}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Paid (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Category</label>
                  <select
                    value={editPaymentCategory}
                    onChange={(e) => setEditPaymentCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="INITIAL_DEPOSIT">Initial Deposit</option>
                    <option value="INSTALMENT">Instalment Payment</option>
                    <option value="FULL_OUTRIGHT">Full Outright Payment</option>
                    <option value="RESERVATION_FEE">Reservation Fee</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={editPaymentChannel}
                  onChange={(e) => setEditPaymentChannel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="MOBILE_MONEY_MTN">MTN Mobile Money</option>
                  <option value="MOBILE_MONEY_TELECEL">Telecel Cash</option>
                  <option value="MOBILE_MONEY_AT">AT Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash (Head Office)</option>
                  <option value="CHEQUE">Bank Cheque</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">External Reference / Gateway ID</label>
                  <input
                    type="text"
                    value={editExternalReference}
                    onChange={(e) => setEditExternalReference(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. OFFICIAL PRINTABLE / PDF SERIALIZED PAYMENT RECEIPT */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar (Hidden when printing via @media print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-3 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-slate-300" />
                <span className="font-bold text-xs text-white">
                  Official Serialized Payment Receipt (Print / PDF Preview)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSendReceiptWhatsApp(selectedReceipt)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>WhatsApp Receipt</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleDownloadPdf(selectedReceipt)}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-900" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-slate-900" />
                  )}
                  <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5 border border-slate-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                  title="Close receipt preview"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Viewport Wrapper for Crisp On-Screen Preview */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              {/* Printable Receipt Voucher Body */}
              <div
                id="official-payment-receipt-voucher"
                className="max-w-[794px] mx-auto bg-white p-7 space-y-4 text-slate-900 font-sans shadow-lg print:shadow-none print:max-w-none print:p-0 print:m-0 w-full"
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
                  #official-payment-receipt-voucher {
                    position: static !important;
                    overflow: visible !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    -webkit-font-smoothing: antialiased !important;
                    text-rendering: geometricPrecision !important;
                  }
                  .print-break-avoid {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                }
              `}</style>

                {/* Receipt Letterhead */}
                <div className="print-break-avoid border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-slate-950 leading-tight">
                      POTENTIAL INVESTMENT REAL ESTATE LTD.
                    </h2>
                    <p className="text-xs text-slate-700 font-semibold leading-tight mt-0.5">
                      Corporate Head Office: Ashaiman New Tulaku, Adjacent to New Tulaku Police Station
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tel: 0541196364 | Email: potentialrealestate04@gmail.com
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1.5 bg-slate-900 text-white font-mono font-bold text-sm rounded shadow-sm">
                      {selectedReceipt.receiptNumber}
                    </span>
                    <p className="text-xs text-slate-700 font-semibold mt-1.5 font-mono">
                      Ref: {selectedReceipt.payment?.transactionReference || 'PAY-REF'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Payment Date: {new Date(selectedReceipt.payment?.paymentDate || Date.now()).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Receipt Title Banner */}
                <div className="print-break-avoid text-center py-2.5 px-4 bg-slate-100 rounded-lg border-y-2 border-slate-900">
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                    OFFICIAL SERIALIZED PAYMENT RECEIPT & TRANSACTION ACKNOWLEDGEMENT
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Valid Electronic Cashier Voucher for Land Allocation & Acquisition Ledger
                  </p>
                </div>

                {/* Client & Payment Metadata */}
                <div className="print-break-avoid grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-bold uppercase block">Received From (Payer):</span>
                    <strong className="text-slate-950 text-sm sm:text-base block">
                      {selectedReceipt.customer?.firstName} {selectedReceipt.customer?.lastName}
                    </strong>
                    <span className="text-xs text-slate-600 block">
                      Customer ID: <strong className="font-mono text-slate-900">{selectedReceipt.customer?.customerNumber}</strong>
                    </span>
                    <span className="text-xs text-slate-600 block">
                      Telephone: <strong className="text-slate-900">{selectedReceipt.customer?.telephone}</strong>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-bold uppercase block">Payment Allocation & Details:</span>
                    <strong className="text-slate-950 text-sm sm:text-base block">
                      {selectedReceipt.allocation?.plot?.plotNumber ? `Plot ${selectedReceipt.allocation.plot.plotNumber}` : (selectedReceipt.payment?.allocation?.plot?.plotNumber ? `Plot ${selectedReceipt.payment.allocation.plot.plotNumber}` : 'Assigned Parcel')}
                    </strong>
                    <span className="text-xs text-slate-600 block">
                      Site Location: <strong className="text-slate-900">{selectedReceipt.allocation?.plot?.landLocation?.name || selectedReceipt.payment?.allocation?.plot?.landLocation?.name || 'Registered Site'}</strong>
                    </span>
                    <span className="text-xs text-slate-600 block">
                      Channel: <strong className="text-slate-900">{selectedReceipt.payment?.paymentChannel?.replace(/_/g, ' ') || 'Cash / Electronic'}</strong>
                      {selectedReceipt.payment?.externalGatewayRef && ` (Ref: ${selectedReceipt.payment.externalGatewayRef})`}
                    </span>
                  </div>
                </div>

                {/* Amount Box */}
                <div
                  className="print-break-avoid rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm border border-slate-800"
                  style={{ padding: '22px 24px', minHeight: '88px', boxSizing: 'border-box' }}
                >
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                      Amount Received in Figures
                    </span>
                    <p
                      className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight"
                      style={{ lineHeight: '1.25', margin: 0, padding: 0 }}
                    >
                      {formatGHS(selectedReceipt.amountReceived)}
                    </p>
                  </div>
                  <div className="text-right max-w-sm sm:max-w-md space-y-1">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                      Amount Received in Words
                    </span>
                    <p
                      className="text-xs sm:text-sm font-semibold text-slate-200 italic leading-relaxed"
                      style={{ margin: 0, padding: 0 }}
                    >
                      {numberToGhanaCedisWords(Number(selectedReceipt.amountReceived))}
                    </p>
                  </div>
                </div>

                {/* Cumulative Financial Position Ledger Table */}
                <div className="print-break-avoid space-y-2">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 block">
                    Customer Account Financial Ledger Position
                  </span>
                  <div className="rounded-xl border border-slate-300 overflow-hidden">
                    <table className="w-full text-xs sm:text-sm text-left">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                        <tr>
                          <th className="p-2.5">Agreed Consideration</th>
                          <th className="p-2.5">Previous Cumulative Paid</th>
                          <th className="p-2.5">Amount Paid Today</th>
                          <th className="p-2.5 text-right">Remaining Balance</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        <tr className="divide-x divide-slate-200">
                          <td className="p-2.5 font-bold text-slate-900">
                            {formatGHS(selectedReceipt.allocation?.agreedPrice || selectedReceipt.payment?.allocation?.agreedPrice || 0)}
                          </td>
                          <td className="p-2.5 text-slate-700 font-medium">
                            {formatGHS(
                              Math.max(
                                0,
                                Number(selectedReceipt.allocation?.totalAmountPaid || selectedReceipt.payment?.allocation?.totalAmountPaid || 0) -
                                Number(selectedReceipt.amountReceived),
                              ),
                            )}
                          </td>
                          <td className="p-2.5 font-black text-emerald-700 text-sm sm:text-base">
                            {formatGHS(selectedReceipt.amountReceived)}
                          </td>
                          <td className="p-2.5 text-right font-black text-amber-700 text-sm sm:text-base">
                            {formatGHS(selectedReceipt.outstandingBalanceAfter)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Execution Signatures & Official Stamp */}
                <div className="print-break-avoid space-y-3 pt-3 border-t-2 border-slate-900">
                  <div className="grid grid-cols-2 gap-8 text-xs">
                    {/* Pod 1: Customer Signature */}
                    <div
                      className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[160px]"
                      style={{ overflow: 'visible' }}
                    >
                      <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wide">
                        Customer Acknowledgement
                      </span>
                      <div className="my-auto text-center py-2.5">
                        <div className="h-12 flex items-end justify-center pb-0.5">
                          <div className="w-full border-b-2 border-slate-900 border-dashed" />
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-1.5 font-medium">Payer Signature / Endorsement</span>
                      </div>
                      <div
                        className="space-y-1 text-xs border-t border-slate-200 pt-2.5 text-slate-700"
                        style={{ overflow: 'visible' }}
                      >
                        <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                          Name: <strong className="text-slate-950 font-bold">{selectedReceipt.customer?.firstName} {selectedReceipt.customer?.lastName}</strong>
                        </p>
                        <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                          Date: _____ / _____ / 20____
                        </p>
                      </div>
                    </div>

                    {/* Pod 2: Authorized Cashier */}
                    <div
                      className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[160px]"
                      style={{ overflow: 'visible' }}
                    >
                      <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wide">
                        Authorized Accounts Officer / Cashier
                      </span>
                      <div className="my-auto text-center py-2.5">
                        <div className="h-12 flex items-end justify-center pb-0.5">
                          <div className="w-full border-b-2 border-slate-900 border-dashed" />
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-1.5 font-medium">Authorized Cashier Signature</span>
                      </div>
                      <div
                        className="space-y-1 text-xs border-t border-slate-200 pt-2.5 text-slate-700"
                        style={{ overflow: 'visible' }}
                      >
                        <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                          Designation: <strong className="text-slate-950 font-bold">Treasury & Accounts Officer</strong>
                        </p>
                        <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                          Date: _____ / _____ / 20____
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cashier Official Stamp Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-800 uppercase block text-[11px]">Official Audit Record:</span>
                      <span>This serialized transaction voucher has been officially reconciled with bank statements and credit logs.</span>
                    </div>
                    <div className="h-14 w-40 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-slate-400 text-center font-bold text-[10px] uppercase">
                      Affix Official Cashier Stamp Here
                    </div>
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
