'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  AlertCircle,
  Edit,
  Smartphone,
  Coins,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MapPin,
  Calendar,
  Layers,
  Check,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react';

// Ghanaian Currency number to words converter for official payment vouchers
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

export default function LandownersPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAID'>('ALL');
  const [expandedObligationId, setExpandedObligationId] = useState<string | null>(null);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [selectedStatementObligation, setSelectedStatementObligation] = useState<any>(null);
  const [isExportingVoucherPdf, setIsExportingVoucherPdf] = useState(false);
  const [isExportingStatementPdf, setIsExportingStatementPdf] = useState(false);

  // Form State for Recording Payment
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('BANK_TRANSFER');
  const [externalReference, setExternalReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Form State for Editing Payment
  const [editingPaymentId, setEditingPaymentId] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editPaymentChannel, setEditPaymentChannel] = useState('BANK_TRANSFER');
  const [editExternalReference, setEditExternalReference] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editChequeNumber, setEditChequeNumber] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editingPaymentContext, setEditingPaymentContext] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete Obligation & Payment State
  const [obligationToDelete, setObligationToDelete] = useState<any>(null);
  const [isDeletingObligation, setIsDeletingObligation] = useState(false);
  const [deleteObligationError, setDeleteObligationError] = useState<string | null>(null);

  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [deletePaymentError, setDeletePaymentError] = useState<string | null>(null);

  const handleDeleteObligation = async () => {
    if (!obligationToDelete) return;
    setIsDeletingObligation(true);
    setDeleteObligationError(null);
    try {
      await apiRequest(`/landowners/obligations/${obligationToDelete.locationId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['landowner-obligations'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setObligationToDelete(null);
    } catch (err: any) {
      setDeleteObligationError(err?.message || 'Failed to delete landowner obligation.');
    } finally {
      setIsDeletingObligation(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsDeletingPayment(true);
    setDeletePaymentError(null);
    try {
      await apiRequest(`/landowners/payments/${paymentToDelete.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['landowner-obligations'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setPaymentToDelete(null);
    } catch (err: any) {
      setDeletePaymentError(err?.message || 'Failed to delete payment voucher.');
    } finally {
      setIsDeletingPayment(false);
    }
  };

  // 1. Fetch Landowner Obligations
  const { data: rawObligations = [], isLoading } = useQuery({
    queryKey: ['landowner-obligations', searchTerm],
    queryFn: () =>
      apiRequest('/landowners/obligations', {
        params: { search: searchTerm || undefined },
      }),
  });

  // Filter obligations
  const obligations = useMemo(() => {
    let list = rawObligations.filter((o: any) => {
      const hasAgreements = (o.paymentsCount && o.paymentsCount > 0) || (o.payments && o.payments.length > 0) || o.agreementId;
      const hasPrice = Number(o.purchasePrice || 0) > 0;
      const hasOwner = o.landownerName && o.landownerName.trim() !== '' && o.landownerName !== 'Direct Landowner / Stool';
      return hasAgreements || hasPrice || hasOwner;
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((o: any) => {
        const matchLoc = (o.locationName || '').toLowerCase().includes(q);
        const matchOwner = (o.landownerName || '').toLowerCase().includes(q);
        const matchRegion = (o.region || '').toLowerCase().includes(q);
        const matchAgr = (o.agreementNumber || '').toLowerCase().includes(q);
        const matchVou = o.payments?.some((p: any) =>
          (p.voucherNumber || '').toLowerCase().includes(q) ||
          (p.bankTransactionRef || '').toLowerCase().includes(q)
        );
        return matchLoc || matchOwner || matchRegion || matchAgr || matchVou;
      });
    }

    if (statusFilter === 'ACTIVE') {
      list = list.filter((o: any) => Number(o.outstandingBalance) > 0);
    } else if (statusFilter === 'PAID') {
      list = list.filter((o: any) => Number(o.purchasePrice) > 0 && Number(o.outstandingBalance) === 0);
    }

    return list;
  }, [rawObligations, searchTerm, statusFilter]);

  // Financial summary metrics
  const stats = useMemo(() => {
    let totalCommitment = 0;
    let totalDisbursed = 0;
    let totalOutstanding = 0;

    rawObligations.forEach((o: any) => {
      totalCommitment += Number(o.purchasePrice || 0);
      totalDisbursed += Number(o.totalPaid || 0);
      totalOutstanding += Number(o.outstandingBalance || 0);
    });

    const liquidationRate = totalCommitment > 0 ? (totalDisbursed / totalCommitment) * 100 : 0;
    return { totalCommitment, totalDisbursed, totalOutstanding, liquidationRate };
  }, [rawObligations]);

  const selectedObligationForRecord = rawObligations.find((o: any) => o.locationId === selectedLocationId);

  const resetRecordForm = () => {
    setSelectedLocationId('');
    setAmountPaid('');
    setPaymentChannel('BANK_TRANSFER');
    setExternalReference('');
    setBankName('');
    setChequeNumber('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError(null);
  };

  const handleOpenRecordForLocation = (locationId?: string) => {
    resetRecordForm();
    if (locationId) {
      setSelectedLocationId(locationId);
    }
    setIsRecordModalOpen(true);
  };

  const handleOpenEditPayment = (p: any, obl: any) => {
    setEditingPaymentId(p.id);
    setEditAmountPaid(String(p.amount || ''));
    setEditPaymentChannel(p.paymentChannel || 'BANK_TRANSFER');
    setEditExternalReference(p.bankTransactionRef || '');
    setEditBankName(p.remarks?.includes('Bank:') ? p.remarks.replace(/^Bank:\s*/, '') : '');
    setEditChequeNumber(p.chequeNumber || '');
    setEditPaymentDate(p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : '');
    setEditNotes(p.remarks || '');
    setEditingPaymentContext({ payment: p, obligation: obl });
    setFormError(null);
    setSuccessMsg(null);
    setIsEditModalOpen(true);
  };

  // Submit Record Payment
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) {
      setFormError('Please select a land location obligation.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await apiRequest('/landowners/payments', {
        method: 'POST',
        body: JSON.stringify({
          landLocationId: selectedLocationId,
          amount: Number(amountPaid),
          paymentChannel,
          bankTransactionRef: externalReference.trim() || undefined,
          bankName: bankName.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          paymentDate: paymentDate || undefined,
          remarks: notes.trim() || (bankName ? `Bank: ${bankName}` : undefined),
        }),
      });

      setIsRecordModalOpen(false);
      resetRecordForm();
      queryClient.invalidateQueries({ queryKey: ['landowner-obligations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      // Automatically display the printable voucher/receipt
      if (res?.payment) {
        setSelectedVoucher({
          payment: res.payment,
          obligation: selectedObligationForRecord || {
            locationName: res.payment.agreement?.landLocation?.name,
            landownerName: res.payment.agreement?.landowner?.fullName,
            purchasePrice: res.payment.agreement?.agreedTotalAmount,
            totalPaid: res.payment.agreement?.totalPaidAmount,
            outstandingBalance: res.outstandingBalance,
          },
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record landowner payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Payment
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/landowners/payments/${editingPaymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: Number(editAmountPaid),
          paymentChannel: editPaymentChannel,
          bankTransactionRef: editExternalReference.trim() || undefined,
          bankName: editBankName.trim() || undefined,
          chequeNumber: editChequeNumber.trim() || undefined,
          paymentDate: editPaymentDate || undefined,
          remarks: editNotes.trim() || (editBankName ? `Bank: ${editBankName}` : undefined),
        }),
      });

      setSuccessMsg('Landowner payment updated and commitment balance adjusted.');
      queryClient.invalidateQueries({ queryKey: ['landowner-obligations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      setTimeout(() => {
        setIsEditModalOpen(false);
        setSuccessMsg(null);
      }, 900);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update landowner payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Channel badge
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
    if (ch?.includes('BANK') || ch === 'BANK_TRANSFER') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Building className="h-3 w-3" />
          <span>Bank Wire / Transfer</span>
        </span>
      );
    }
    if (ch === 'CASH') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Coins className="h-3 w-3" />
          <span>Cash Disbursement</span>
        </span>
      );
    }
    if (ch === 'CHEQUE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <FileText className="h-3 w-3" />
          <span>Cheque Payout</span>
        </span>
      );
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{ch}</span>;
  };

  // Send receipt via WhatsApp
  const handleSendWhatsAppReceipt = (v: any) => {
    const payment = v.payment || v;
    const obl = v.obligation || payment.agreement || {};
    const phone = (obl.landownerPhone || payment.agreement?.landowner?.telephone || '').replace(/[\s\-\(\)\+]/g, '');
    const intlPhone = phone.startsWith('0') ? `233${phone.slice(1)}` : phone.startsWith('233') ? phone : `233${phone}`;

    const vouNumber = payment.voucherNumber || 'VOU-REC';
    const amountStr = formatGHS(payment.amount);
    const balanceStr = formatGHS(obl.outstandingBalance ?? payment.agreement?.outstandingBalance ?? 0);
    const locName = obl.locationName || payment.agreement?.landLocation?.name || 'Registered Site';
    const landowner = obl.landownerName || payment.agreement?.landowner?.fullName || 'Landowner';

    const message = `*POTENTIAL INVESTMENT REAL ESTATE LTD.*
_Official Landowner Disbursement Voucher & Receipt_

Dear *${landowner}*,

We have processed a land acquisition disbursement payment to you. Here are your transaction details:

🧾 *Voucher Number:* ${vouNumber}
📍 *Land Location:* ${locName}
💰 *Amount Disbursed:* ${amountStr}
💳 *Disbursement Channel:* ${payment.paymentChannel?.replace(/_/g, ' ')}
⏳ *Remaining Commitment Balance:* ${balanceStr}

Your official payout voucher has been archived on our company financial ledger.
Thank you for your ongoing partnership!
📞 Tel: 0541196364 | ✉️ potentialrealestate04@gmail.com | 📍 Ashaiman New Tulaku, Adjacent to New Tulaku Police Station`;

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Dedicated Automated Ultra-Sharp Headless PDF Download for Landowner Voucher using jsPDF + html2canvas (Lossless PNG @ 336 DPI)
  const handleDownloadVoucherPdf = async (voucher: any) => {
    if (!voucher) return;
    setIsExportingVoucherPdf(true);
    try {
      const el = document.getElementById('official-landowner-payment-voucher');
      if (!el) {
        throw new Error('Landowner voucher element not found.');
      }

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 3.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('official-landowner-payment-voucher');
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

      const voucherRef = voucher.voucherNumber || voucher.transactionReference || 'Voucher';
      const filename = `Landowner_Voucher_${voucherRef.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      console.error('Headless PDF export error:', err);
      alert('Could not export PDF directly. Please use the Print button to Save as PDF.');
    } finally {
      setIsExportingVoucherPdf(false);
    }
  };

  // Dedicated Automated Ultra-Sharp Headless PDF Download for Landowner Statement of Account
  const handleDownloadStatementPdf = async (obligation: any) => {
    if (!obligation) return;
    setIsExportingStatementPdf(true);
    try {
      const el = document.getElementById('official-landowner-statement');
      if (!el) {
        throw new Error('Landowner statement element not found.');
      }

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 3.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('official-landowner-statement');
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

      const locName = (obligation.locationName || 'Site').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Landowner_Statement_${locName}.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      console.error('Headless PDF export error:', err);
      alert('Could not export PDF directly. Please use the Print button to Save as PDF.');
    } finally {
      setIsExportingStatementPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Landowner Obligations & Payouts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Feature land locations, landowners, and purchase prices. Record and edit disbursements, view full payment history, and print official PDF receipts and vouchers.
          </p>
        </div>
        {hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']) && (
          <button
            type="button"
            onClick={() => handleOpenRecordForLocation()}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Landowner Payment</span>
          </button>
        )}
      </div>

      {/* Top Financial Portfolio Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Acquisition Commitment
          </span>
          <p className="text-xl font-black text-slate-900 mt-1">{formatGHS(stats.totalCommitment)}</p>
          <span className="text-[11px] text-slate-400">Total agreed land purchase price</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Total Disbursed to Landowners
          </span>
          <p className="text-xl font-black text-emerald-700 mt-1">{formatGHS(stats.totalDisbursed)}</p>
          <span className="text-[11px] text-emerald-600">Total payments paid out to date</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
            Outstanding Commitment Due
          </span>
          <p className="text-xl font-black text-blue-700 mt-1">{formatGHS(stats.totalOutstanding)}</p>
          <span className="text-[11px] text-blue-600">Remaining to be paid to landowners</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Liquidation Rate
          </span>
          <p className="text-xl font-black text-slate-900 mt-1">{stats.liquidationRate.toFixed(1)}%</p>
          <span className="text-[11px] text-slate-400">Of total land purchase settled</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex-1 max-w-lg">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search obligations by land location, landowner, or voucher number..."
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 bg-slate-100 rounded"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Locations ({rawObligations.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'ACTIVE' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Balances
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'PAID' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paid in Full
          </button>
        </div>
      </div>

      {/* Main Landowner Obligations Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
          </div>
        ) : obligations.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No landowner obligations found</p>
            <p className="text-xs text-slate-400 mt-1">
              Add land locations with purchase prices in Land & Plot Inventory or create land agreements.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Land Location</th>
                  <th className="py-3 px-4">Landowner / Stool</th>
                  <th className="py-3 px-4 text-right">Purchase Price</th>
                  <th className="py-3 px-4 text-right">Total Disbursed</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {obligations.map((obl: any) => {
                  const purchasePrice = Number(obl.purchasePrice || 0);
                  const totalPaid = Number(obl.totalPaid || 0);
                  const balance = Number(obl.outstandingBalance || 0);
                  const isFullyPaid = purchasePrice > 0 && balance === 0;
                  const isExpanded = expandedObligationId === obl.id;
                  const payments = obl.payments || [];

                  return (
                    <React.Fragment key={obl.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setExpandedObligationId(isExpanded ? null : obl.id)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                              title={isExpanded ? 'Collapse payment history' : 'View payment history'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">{obl.locationName}</span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{obl.region}{obl.district ? `, ${obl.district}` : ''} &bull; {obl.totalLandSizeAcres} Acres</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{obl.landownerName}</span>
                          {obl.landownerPhone ? (
                            <span className="text-[10px] text-slate-500 font-mono block">{obl.landownerPhone}</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {obl.agreementNumber || 'Direct Stool Contract'}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                          {formatGHS(purchasePrice)}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                          {formatGHS(totalPaid)}
                        </td>

                        <td className="py-3 px-4 text-right font-black text-blue-700 text-sm">
                          {formatGHS(balance)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Check className="h-3 w-3 mr-1" />
                              <span>Paid in Full</span>
                            </span>
                          ) : totalPaid > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>Installments Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <span>Pending Payout</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            {balance > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordForLocation(obl.locationId)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center space-x-1"
                                title="Record payment to landowner"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Record Payment</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordForLocation(obl.locationId)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                              >
                                Add Payout
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setExpandedObligationId(isExpanded ? null : obl.id)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center space-x-1"
                              title="View disbursement history & vouchers"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
                              <span>History ({payments.length})</span>
                            </button>

                            {payments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedStatementObligation(obl)}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition cursor-pointer"
                                title="Print Complete Landowner Statement"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Delete Landowner Obligation Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setObligationToDelete(obl);
                                setDeleteObligationError(null);
                              }}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                              title="Delete landowner obligation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* In-Line Expandable Payment History Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-y border-blue-200">
                          <td colSpan={7} className="p-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Building className="h-4 w-4 text-blue-600" />
                                  <h4 className="font-bold text-slate-900 text-xs">
                                    Disbursement Payment History for {obl.locationName} &bull; Landowner: {obl.landownerName}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {payments.length} Payment{payments.length === 1 ? '' : 's'} Logged
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  {payments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedStatementObligation(obl)}
                                      className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Printer className="h-3 w-3" />
                                      <span>Print Full Statement</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecordForLocation(obl.locationId)}
                                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Record Another Payment</span>
                                  </button>
                                </div>
                              </div>

                              {payments.length === 0 ? (
                                <p className="text-xs text-slate-400 py-4 text-center">
                                  No disbursements recorded for this landowner obligation yet. Click "Record Payment" to log a payment.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                      <tr>
                                        <th className="py-2 px-3">Voucher #</th>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Payment Channel</th>
                                        <th className="py-2 px-3">Transaction / Slip Ref</th>
                                        <th className="py-2 px-3 text-right">Amount Paid</th>
                                        <th className="py-2 px-3">Remarks / Notes</th>
                                        <th className="py-2 px-3 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {payments.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                            {p.voucherNumber}
                                          </td>
                                          <td className="py-2 px-3 text-slate-600">
                                            {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                                          </td>
                                          <td className="py-2 px-3">
                                            {getChannelBadge(p.paymentChannel)}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                            {p.bankTransactionRef || p.chequeNumber || 'Direct Voucher'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-emerald-700 text-sm">
                                            {formatGHS(p.amount)}
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                                            {p.remarks || 'Site Acquisition Disbursement'}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <div className="inline-flex items-center space-x-1.5">
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEditPayment(p, obl)}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                                title="Edit this payment record"
                                              >
                                                <Edit className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setSelectedVoucher({
                                                    payment: p,
                                                    obligation: obl,
                                                  })
                                                }
                                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold transition cursor-pointer flex items-center space-x-1 text-xs"
                                                title="Print or Save PDF Receipt Voucher"
                                              >
                                                <Printer className="h-3.5 w-3.5" />
                                                <span>Print / PDF</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPaymentToDelete(p);
                                                  setDeletePaymentError(null);
                                                }}
                                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                                                title="Delete this payout record"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
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

      {/* ========================================================================= */}
      {/* RECORD LANDOWNER PAYMENT MODAL */}
      {/* ========================================================================= */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Building className="h-5 w-5 text-blue-400" />
                  <span>Record Landowner Payment</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Record installment or full land purchase disbursement with official PDF voucher generation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                title="Close modal"
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
              {/* Land Location / Obligation Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Land Location & Landowner Obligation *
                </label>
                <select
                  required
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select Land Location Obligation --</option>
                  {rawObligations.map((obl: any) => (
                    <option key={obl.id} value={obl.locationId}>
                      {obl.locationName} — Landowner: {obl.landownerName} | Purchase Price: {formatGHS(obl.purchasePrice)} | Bal: {formatGHS(obl.outstandingBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Obligation Info Pill */}
              {selectedObligationForRecord && (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-blue-800 uppercase font-semibold block">Purchase Price</span>
                    <strong className="text-slate-900 text-xs">{formatGHS(selectedObligationForRecord.purchasePrice)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-800 uppercase font-semibold block">Total Disbursed</span>
                    <strong className="text-emerald-700 text-xs">{formatGHS(selectedObligationForRecord.totalPaid)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-800 uppercase font-semibold block">Outstanding Due</span>
                    <strong className="text-blue-700 text-xs">{formatGHS(selectedObligationForRecord.outstandingBalance)}</strong>
                  </div>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount to Disburse (GH₵) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none font-mono text-sm font-bold text-slate-900"
                    />
                    {selectedObligationForRecord && Number(selectedObligationForRecord.outstandingBalance) > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountPaid(String(selectedObligationForRecord.outstandingBalance))}
                        className="absolute right-2 top-2 px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold cursor-pointer"
                      >
                        Full Bal
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Channel: Bank / MoMo / Cash / Cheque */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Payment Channel *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'BANK_TRANSFER', label: 'Bank Direct Transfer' },
                    { id: 'MOBILE_MONEY_MTN', label: 'MTN Mobile Money' },
                    { id: 'MOBILE_MONEY_TELECEL', label: 'Telecel Cash' },
                    { id: 'CASH', label: 'Direct Cash' },
                    { id: 'CHEQUE', label: 'Bank Cheque' },
                    { id: 'MOBILE_MONEY_AT', label: 'AT Money' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setPaymentChannel(ch.id)}
                      className={`p-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                        paymentChannel === ch.id
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    External Reference (Wire Ref / MoMo ID / Teller)
                  </label>
                  <input
                    type="text"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="e.g. GCB-WIRE-98240 or Slip #4092"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name / Provider</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. GCB Bank / Stanbic / Ecobank"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {paymentChannel === 'CHEQUE' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-984012"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Remarks / Audit Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Installment 1 of land acquisition purchase"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
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
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Recording Payout...' : 'Record Payment & Issue Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT LANDOWNER PAYMENT MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Edit className="h-5 w-5 text-amber-400" />
                  <span>Edit Landowner Payment Record</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Update payment amount, channel, reference, date, or remarks. Commitment balances adjust automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                title="Close modal"
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
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Linked Location & Beneficiary</span>
                <p className="font-bold text-slate-900 text-sm">
                  {editingPaymentContext?.obligation?.locationName || 'Land Location'}
                </p>
                <p className="text-slate-600 text-xs">
                  Landowner: <strong>{editingPaymentContext?.obligation?.landownerName || 'Stool Authority'}</strong> &bull;{' '}
                  Voucher: <strong className="font-mono">{editingPaymentContext?.payment?.voucherNumber}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Disbursed (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={editAmountPaid}
                    onChange={(e) => setEditAmountPaid(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={editPaymentChannel}
                  onChange={(e) => setEditPaymentChannel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="BANK_TRANSFER">Bank Direct Transfer / Wire</option>
                  <option value="MOBILE_MONEY_MTN">MTN Mobile Money</option>
                  <option value="MOBILE_MONEY_TELECEL">Telecel Cash</option>
                  <option value="MOBILE_MONEY_AT">AT Money</option>
                  <option value="CASH">Direct Cash</option>
                  <option value="CHEQUE">Bank Cheque</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">External Transaction Reference</label>
                  <input
                    type="text"
                    value={editExternalReference}
                    onChange={(e) => setEditExternalReference(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name / Provider</label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {editPaymentChannel === 'CHEQUE' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    value={editChequeNumber}
                    onChange={(e) => setEditChequeNumber(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Audit Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                />
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
      {/* OFFICIAL PRINTABLE / PDF LANDOWNER PAYMENT VOUCHER & RECEIPT */}
      {/* ========================================================================= */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar (Hidden when printing via @media print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-3 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-slate-300" />
                <span className="font-bold text-xs text-white">
                  Official Landowner Payment Voucher & Receipt (Print / PDF Preview)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppReceipt(selectedVoucher)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>WhatsApp Receipt</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingVoucherPdf}
                  onClick={() => handleDownloadVoucherPdf(selectedVoucher)}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isExportingVoucherPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-900" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-slate-900" />
                  )}
                  <span>{isExportingVoucherPdf ? 'Generating PDF...' : 'Download PDF'}</span>
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
                  onClick={() => setSelectedVoucher(null)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                  title="Close receipt preview"
                >
                  <X className="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Viewport Wrapper for Crisp On-Screen Preview */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              {/* Printable Voucher Body */}
              <div
                id="official-landowner-payment-voucher"
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
                  #official-landowner-payment-voucher {
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

              {/* Letterhead */}
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
                    {selectedVoucher.payment?.voucherNumber || 'VOUCHER'}
                  </span>
                  <p className="text-xs text-slate-700 font-semibold mt-1.5 font-mono">
                    Ref: {selectedVoucher.payment?.bankTransactionRef || selectedVoucher.payment?.chequeNumber || 'DIRECT-VOUCHER'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Voucher Date: {new Date(selectedVoucher.payment?.paymentDate || Date.now()).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Title Banner */}
              <div className="print-break-avoid text-center py-2.5 px-4 bg-slate-100 rounded-lg border-y-2 border-slate-900">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                  OFFICIAL LAND ACQUISITION PAYMENT VOUCHER & DISBURSEMENT RECEIPT
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Statutory Disbursement Record for Landowner Consideration & Stool Allotment
                </p>
              </div>

              {/* Obligation & Beneficiary Metadata */}
              <div className="print-break-avoid grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Beneficiary Landowner / Stool:</span>
                  <strong className="text-slate-950 text-sm sm:text-base block">
                    {selectedVoucher.obligation?.landownerName || selectedVoucher.payment?.agreement?.landowner?.fullName || 'Stool Authority'}
                  </strong>
                  <span className="text-xs text-slate-600 block">
                    Contact: <strong className="text-slate-900">{selectedVoucher.obligation?.landownerPhone || selectedVoucher.payment?.agreement?.landowner?.telephone || 'On Record'}</strong>
                  </span>
                  <span className="text-xs text-slate-600 block">
                    Agreement No: <strong className="font-mono text-slate-900">{selectedVoucher.obligation?.agreementNumber || selectedVoucher.payment?.agreement?.agreementNumber || 'LOA-RECORD'}</strong>
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Land Acquisition Site & Channel:</span>
                  <strong className="text-slate-950 text-sm sm:text-base block">
                    {selectedVoucher.obligation?.locationName || selectedVoucher.payment?.agreement?.landLocation?.name || 'Registered Site'}
                  </strong>
                  <span className="text-xs text-slate-600 block">
                    Jurisdiction: <strong className="text-slate-900">{selectedVoucher.obligation?.region || selectedVoucher.payment?.agreement?.landLocation?.region || 'Ghana'}</strong>
                  </span>
                  <span className="text-xs text-slate-600 block">
                    Disbursement Channel: <strong className="text-slate-900">{selectedVoucher.payment?.paymentChannel?.replace(/_/g, ' ') || 'Bank Transfer'}</strong>
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
                    Amount Disbursed in Figures
                  </span>
                  <p
                    className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight"
                    style={{ lineHeight: '1.25', margin: 0, padding: 0 }}
                  >
                    {formatGHS(selectedVoucher.payment?.amount)}
                  </p>
                </div>
                <div className="text-right max-w-sm sm:max-w-md space-y-1">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                    Amount Disbursed in Words
                  </span>
                  <p
                    className="text-xs sm:text-sm font-semibold text-slate-200 italic leading-relaxed"
                    style={{ margin: 0, padding: 0 }}
                  >
                    {numberToGhanaCedisWords(Number(selectedVoucher.payment?.amount))}
                  </p>
                </div>
              </div>

              {/* Cumulative Financial Position Table */}
              <div className="print-break-avoid space-y-2">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 block">
                  Land Acquisition Financial Ledger Position
                </span>
                <div className="rounded-xl border border-slate-300 overflow-hidden">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                      <tr>
                        <th className="p-2.5">Agreed Purchase Price</th>
                        <th className="p-2.5">Previous Payments</th>
                        <th className="p-2.5">Amount Disbursed Today</th>
                        <th className="p-2.5 text-right">Remaining Commitment Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr className="divide-x divide-slate-200">
                        <td className="p-2.5 font-bold text-slate-900">
                          {formatGHS(selectedVoucher.obligation?.purchasePrice || selectedVoucher.payment?.agreement?.agreedTotalAmount || 0)}
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">
                          {formatGHS(
                            Math.max(
                              0,
                              Number(selectedVoucher.obligation?.totalPaid || selectedVoucher.payment?.agreement?.totalPaidAmount || 0) -
                                Number(selectedVoucher.payment?.amount),
                            ),
                          )}
                        </td>
                        <td className="p-2.5 font-black text-emerald-700 text-sm sm:text-base">
                          {formatGHS(selectedVoucher.payment?.amount)}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-950 text-sm sm:text-base">
                          {formatGHS(
                            selectedVoucher.obligation?.outstandingBalance !== undefined
                              ? selectedVoucher.obligation.outstandingBalance
                              : selectedVoucher.payment?.agreement?.outstandingBalance || 0,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {selectedVoucher.payment?.remarks && (
                <div className="print-break-avoid p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Payment Remarks / Memo:</span>
                  <p className="text-slate-800 italic mt-0.5">{selectedVoucher.payment.remarks}</p>
                </div>
              )}

              {/* Signatures & Corporate Seal */}
              <div className="print-break-avoid space-y-3 pt-3 border-t-2 border-slate-900">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  {/* Pod 1: Financial Officer */}
                  <div
                    className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[160px]"
                    style={{ overflow: 'visible' }}
                  >
                    <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wide">
                      Authorized Financial Officer / Managing Director
                    </span>
                    <div className="my-auto text-center py-2.5">
                      <div className="h-12 flex items-end justify-center pb-0.5">
                        <div className="w-full border-b-2 border-slate-900 border-dashed" />
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1.5 font-medium">Authorized Disbursing Officer Signature</span>
                    </div>
                    <div
                      className="space-y-1 text-xs border-t border-slate-200 pt-2.5 text-slate-700"
                      style={{ overflow: 'visible' }}
                    >
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Designation: <strong className="text-slate-950 font-bold">Director of Finance & Operations</strong>
                      </p>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Date: _____ / _____ / 20____
                      </p>
                    </div>
                  </div>

                  {/* Pod 2: Landowner / Stool Rep */}
                  <div
                    className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[160px]"
                    style={{ overflow: 'visible' }}
                  >
                    <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wide">
                      Landowner / Stool Representative Signature
                    </span>
                    <div className="my-auto text-center py-2.5">
                      <div className="h-12 flex items-end justify-center pb-0.5">
                        <div className="w-full border-b-2 border-slate-900 border-dashed" />
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1.5 font-medium">Beneficiary Payee Signature</span>
                    </div>
                    <div
                      className="space-y-1 text-xs border-t border-slate-200 pt-2.5 text-slate-700"
                      style={{ overflow: 'visible' }}
                    >
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Name: <strong className="text-slate-950 font-bold">{selectedVoucher.obligation?.landownerName || 'Stool Representative'}</strong>
                      </p>
                      <p className="leading-normal" style={{ overflow: 'visible', margin: 0 }}>
                        Date: _____ / _____ / 20____
                      </p>
                    </div>
                  </div>
                </div>

                {/* Landowner Voucher Stamp Pod */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs">
                  <div className="text-slate-600">
                    <span className="font-bold text-slate-800 uppercase block text-[11px]">Official Corporate Endorsement:</span>
                    <span>This disbursement voucher confirms discharge of landowner obligation in accordance with the executed deed.</span>
                  </div>
                  <div className="h-14 w-40 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-slate-400 text-center font-bold text-[10px] uppercase">
                    Affix Corporate Stamp Here
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE FULL LANDOWNER STATEMENT / LEDGER */}
      {/* ========================================================================= */}
      {selectedStatementObligation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-3 print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-slate-300" />
                <span className="font-bold text-xs text-white">
                  Landowner Acquisition Statement of Account (Print / PDF)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={isExportingStatementPdf}
                  onClick={() => handleDownloadStatementPdf(selectedStatementObligation)}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isExportingStatementPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-900" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-slate-900" />
                  )}
                  <span>{isExportingStatementPdf ? 'Generating PDF...' : 'Download PDF'}</span>
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
                  onClick={() => setSelectedStatementObligation(null)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                  title="Close statement"
                >
                  <X className="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Viewport Wrapper for Crisp On-Screen Preview */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              {/* Statement Body */}
              <div
                id="official-landowner-statement"
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
                  #official-landowner-statement {
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
              {/* Letterhead */}
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
                    STATEMENT OF ACCOUNT
                  </span>
                  <p className="text-xs text-slate-700 font-semibold mt-1.5 font-mono">
                    Ref: LOA-{selectedStatementObligation.locationId?.slice(0, 8) || 'LEDGER'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    As of: {new Date().toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Title Banner */}
              <div className="print-break-avoid text-center py-2.5 px-4 bg-slate-100 rounded-lg border-y-2 border-slate-900">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                  OFFICIAL STATEMENT OF ACCOUNT & DISBURSEMENT LEDGER
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Comprehensive Land Acquisition Commitment & Payout Audit Trail
                </p>
              </div>

              {/* Metadata */}
              <div className="print-break-avoid grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Acquisition Land Location:</span>
                  <strong className="text-slate-950 text-sm sm:text-base block">{selectedStatementObligation.locationName}</strong>
                  <span className="text-xs text-slate-600 block">
                    Region: <strong className="text-slate-900">{selectedStatementObligation.region}</strong> &bull; Total Acreage: <strong className="text-slate-900">{selectedStatementObligation.totalLandSizeAcres} Acres</strong>
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Landowner / Stool Authority:</span>
                  <strong className="text-slate-950 text-sm sm:text-base block">{selectedStatementObligation.landownerName}</strong>
                  <span className="text-xs text-slate-600 block">
                    Agreed Purchase Consideration: <strong className="text-slate-950">{formatGHS(selectedStatementObligation.purchasePrice)}</strong>
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="print-break-avoid space-y-2">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 block">
                  Disbursement Transaction Audit Ledger
                </span>
                <div className="rounded-xl border border-slate-300 overflow-hidden">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Voucher #</th>
                        <th className="p-2.5">Channel</th>
                        <th className="p-2.5">Reference</th>
                        <th className="p-2.5 text-right">Amount Disbursed</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedStatementObligation.payments && selectedStatementObligation.payments.length > 0 ? (
                        selectedStatementObligation.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-slate-700 font-medium">{new Date(p.paymentDate).toLocaleDateString('en-GB')}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-950">{p.voucherNumber}</td>
                            <td className="p-2.5 text-slate-700 font-medium">{p.paymentChannel?.replace(/_/g, ' ')}</td>
                            <td className="p-2.5 font-mono text-xs text-slate-600">{p.bankTransactionRef || '-'}</td>
                            <td className="p-2.5 text-right font-black text-emerald-700 text-sm">{formatGHS(p.amount)}</td>
                            <td className="p-2.5 text-slate-600 text-xs italic">{p.remarks || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                            No disbursements recorded yet for this obligation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-xs sm:text-sm">
                      <tr className="border-b border-slate-200">
                        <td colSpan={4} className="p-2.5 text-right font-bold text-slate-700">Total Agreed Purchase Price:</td>
                        <td className="p-2.5 text-right font-black text-slate-950">{formatGHS(selectedStatementObligation.purchasePrice)}</td>
                        <td></td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td colSpan={4} className="p-2.5 text-right font-bold text-emerald-700">Total Disbursed to Date:</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">{formatGHS(selectedStatementObligation.totalPaid)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="p-2.5 text-right font-black text-slate-900 text-sm sm:text-base">Remaining Balance Due:</td>
                        <td className="p-2.5 text-right font-black text-slate-950 text-sm sm:text-base">
                          {formatGHS(selectedStatementObligation.outstandingBalance)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Certification & Execution Signatures */}
              <div className="print-break-avoid space-y-3 pt-3 border-t-2 border-slate-900">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  {/* Pod 1: Prepared By */}
                  <div className="p-3.5 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[145px]">
                    <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1 text-center block">
                      Prepared By (Accounts Officer)
                    </span>
                    <div className="my-auto text-center py-2">
                      <div className="h-14 flex items-end justify-center">
                        <div className="w-full border-b-2 border-slate-900 border-dashed" />
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">Conveyance & Accounts Officer Signature</span>
                    </div>
                    <div className="space-y-1 text-xs border-t border-slate-200 pt-2 text-slate-700">
                      <p>Designation: <strong className="text-slate-900">Senior Financial Accountant</strong></p>
                      <p>Date: _____ / _____ / 20____</p>
                    </div>
                  </div>

                  {/* Pod 2: Certified By */}
                  <div className="p-3.5 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[145px]">
                    <span className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1 text-center block">
                      Certified & Audited By (Managing Director)
                    </span>
                    <div className="my-auto text-center py-2">
                      <div className="h-14 flex items-end justify-center">
                        <div className="w-full border-b-2 border-slate-900 border-dashed" />
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">Executive Certification Signature</span>
                    </div>
                    <div className="space-y-1 text-xs border-t border-slate-200 pt-2 text-slate-700">
                      <p>Name: <strong className="text-slate-900">Dr. Kofi Mensah (MD)</strong></p>
                      <p>Date: _____ / _____ / 20____</p>
                    </div>
                  </div>
                </div>

                {/* Audit Stamp Pod */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs">
                  <div className="text-slate-600">
                    <span className="font-bold text-slate-800 uppercase block text-[11px]">Official Audit Certificate:</span>
                    <span>This statement accurately certifies all financial disbursements made towards land acquisition obligations.</span>
                  </div>
                  <div className="h-14 w-40 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-slate-400 text-center font-bold text-[10px] uppercase">
                    Affix Official Audit Stamp Here
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE LANDOWNER OBLIGATION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {obligationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Landowner Obligation?</h3>
                <p className="text-xs text-slate-500">{obligationToDelete.locationName}</p>
              </div>
            </div>

            {deleteObligationError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deleteObligationError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete the landowner acquisition obligation for{' '}
              <strong className="text-slate-900">{obligationToDelete.landownerName}</strong> at{' '}
              <strong className="text-slate-900">{obligationToDelete.locationName}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1 mb-5">
              <p className="font-semibold">Important Notice:</p>
              <p className="text-[11px] text-amber-700">
                This will delete all associated landowner agreements, payout vouchers, and corporate expense records for this land site.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setObligationToDelete(null)}
                disabled={isDeletingObligation}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteObligation}
                disabled={isDeletingObligation}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-sm transition flex items-center gap-1.5"
              >
                {isDeletingObligation ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Obligation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE PAYOUT VOUCHER CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Payout Voucher?</h3>
                <p className="text-xs text-slate-500 font-mono">{paymentToDelete.voucherNumber || 'Direct Voucher'}</p>
              </div>
            </div>

            {deletePaymentError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deletePaymentError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete payout voucher{' '}
              <strong className="text-slate-900 font-mono">{paymentToDelete.voucherNumber || 'Direct Voucher'}</strong>{' '}
              for <strong className="text-slate-900">{formatGHS(paymentToDelete.amount)}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1 mb-5">
              <p className="font-semibold">Balance Adjustment:</p>
              <p className="text-[11px] text-amber-700">
                Deleting this payout voucher will automatically restore this amount to the outstanding balance due to the landowner and remove its corporate expense entry.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={isDeletingPayment}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={isDeletingPayment}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-sm transition flex items-center gap-1.5"
              >
                {isDeletingPayment ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Voucher</span>
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
