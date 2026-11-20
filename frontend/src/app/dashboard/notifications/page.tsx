'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  MessageSquare,
  Mail,
  Smartphone,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Filter,
  Play,
  Send,
  Bell,
  Calendar,
  Megaphone,
  FileCheck,
  Users,
  CheckCircle2,
  X,
  Search,
  Loader2,
  DollarSign,
  Layers,
} from 'lucide-react';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  // Filters & State
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Modals State
  const [isDueRemindersModalOpen, setIsDueRemindersModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isDocReadyModalOpen, setIsDocReadyModalOpen] = useState(false);

  // Reminders Action State
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<string[]>([]);
  const [remindersSuccessMsg, setRemindersSuccessMsg] = useState<string | null>(null);

  // Promo Form State
  const [promoTitle, setPromoTitle] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoLocation, setPromoLocation] = useState('');
  const [promoOffer, setPromoOffer] = useState('');
  const [promoChannel, setPromoChannel] = useState<'ALL' | 'WHATSAPP' | 'EMAIL'>('ALL');
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);

  // Document Ready Form State
  const [docCustomerId, setDocCustomerId] = useState('');
  const [docType, setDocType] = useState('Official Indenture & Cadastral Site Plan');
  const [docCollectionOffice, setDocCollectionOffice] = useState('Head Office - Ashaiman New Tulaku, Adjacent to New Tulaku Police Station');
  const [docOfficeHours, setDocOfficeHours] = useState('Monday – Friday, 8:30 AM – 5:00 PM');
  const [isSendingDocNotice, setIsSendingDocNotice] = useState(false);
  const [docNoticeSuccessMsg, setDocNoticeSuccessMsg] = useState<string | null>(null);

  // 1. Fetch Notification Logs
  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['notifications-logs', channelFilter, statusFilter],
    queryFn: () =>
      apiRequest('/notifications', {
        params: {
          channel: channelFilter !== 'ALL' ? channelFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          limit: 50,
        },
      }),
  });

  // 2. Fetch Due Reminders Preview
  const { data: remindersPreview, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['notifications-due-reminders-preview'],
    queryFn: () => apiRequest('/notifications/reminders-preview'),
  });

  // 3. Fetch Customers list for Document Ready dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-notifications'],
    queryFn: () => apiRequest('/customers', { params: { limit: 100 } }),
  });

  const logs = logsData?.records || [];
  const dueCustomers = remindersPreview?.customers || [];
  const rawCustomers = customersData?.data || customersData?.customers || [];

  // Toggle selection of all eligible due clients
  const handleToggleSelectAllDue = () => {
    if (selectedAllocationIds.length === dueCustomers.length) {
      setSelectedAllocationIds([]);
    } else {
      setSelectedAllocationIds(dueCustomers.map((c: any) => c.allocationId));
    }
  };

  const handleToggleAllocation = (id: string) => {
    setSelectedAllocationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Submit Monthly Due Reminders
  const handleBroadcastReminders = async () => {
    setIsSendingReminders(true);
    setRemindersSuccessMsg(null);
    try {
      const payload =
        selectedAllocationIds.length > 0
          ? { allocationIds: selectedAllocationIds }
          : undefined;

      const res = await apiRequest('/notifications/send-monthly-reminders', {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });

      setRemindersSuccessMsg(
        `Dispatched ${res.successfulCount || 0} monthly reminders successfully via WhatsApp & Email!`
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-due-reminders-preview'] });
      setTimeout(() => {
        setIsDueRemindersModalOpen(false);
        setRemindersSuccessMsg(null);
        setSelectedAllocationIds([]);
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Failed to dispatch monthly payment reminders');
    } finally {
      setIsSendingReminders(false);
    }
  };

  // Submit Promo Campaign Broadcast
  const handleSendPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim() || !promoMessage.trim()) {
      alert('Please provide a campaign title and message.');
      return;
    }

    setIsSendingPromo(true);
    setPromoSuccessMsg(null);
    try {
      const res = await apiRequest('/notifications/send-promo', {
        method: 'POST',
        body: JSON.stringify({
          title: promoTitle.trim(),
          message: promoMessage.trim(),
          location: promoLocation.trim() || undefined,
          offer: promoOffer.trim() || undefined,
          channel: promoChannel,
        }),
      });

      setPromoSuccessMsg(
        `Broadcast queued for ${res.targetedCustomers || 0} clients (${res.dispatchedCount || 0} transmissions).`
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
      setTimeout(() => {
        setIsPromoModalOpen(false);
        setPromoSuccessMsg(null);
        setPromoTitle('');
        setPromoMessage('');
        setPromoLocation('');
        setPromoOffer('');
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Failed to dispatch promotional broadcast');
    } finally {
      setIsSendingPromo(false);
    }
  };

  // Submit Document Ready Notification
  const handleSendDocReadyNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docCustomerId) {
      alert('Please select a customer.');
      return;
    }

    setIsSendingDocNotice(true);
    setDocNoticeSuccessMsg(null);
    try {
      const res = await apiRequest('/notifications/send-document-ready', {
        method: 'POST',
        body: JSON.stringify({
          customerId: docCustomerId,
          documentType: docType.trim(),
          collectionOffice: docCollectionOffice.trim(),
          officeHours: docOfficeHours.trim(),
        }),
      });

      setDocNoticeSuccessMsg(res.message || 'Collection notice sent successfully via WhatsApp & Email.');
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
      setTimeout(() => {
        setIsDocReadyModalOpen(false);
        setDocNoticeSuccessMsg(null);
        setDocCustomerId('');
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Failed to send document collection notice');
    } finally {
      setIsSendingDocNotice(false);
    }
  };

  // Manual Retry
  const handleRetry = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/retry`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
    } catch (err: any) {
      alert(err?.message || 'Retry failed');
    }
  };

  // Process Queue Worker
  const handleProcessQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const res = await apiRequest('/notifications/process-queue', { method: 'POST' });
      alert(`Worker run complete: ${res.successful} sent, ${res.failed} failed.`);
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
    } catch (err: any) {
      alert(err?.message || 'Processing failed');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'READ':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {status}
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            SENT
          </span>
        );
      case 'QUEUED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            QUEUED
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customer Automated Notifications Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Broadcast monthly instalment reminders, promotional announcements, and document collection alerts via WhatsApp & Email.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleProcessQueue}
            disabled={isProcessingQueue}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 text-slate-600" />
            <span>{isProcessingQueue ? 'Processing...' : 'Run Queue Worker'}</span>
          </button>
        </div>
      </div>

      {/* SENDER IDENTITY & CHANNEL DISPATCH STATUS */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            PI
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900">Potential Investment Real Estate Ltd.</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                Verified Sender Identity
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated notifications are dispatched under the official company name, phone, and email channels.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* WhatsApp Channel */}
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-500">WhatsApp Sender:</span>
            <span className="font-semibold text-emerald-800">0541196364</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              Company Name Header
            </span>
          </div>

          {/* Email Channel */}
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-500">Email Sender:</span>
            <span className="font-semibold text-blue-800">potentialrealestate04@gmail.com</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium border border-blue-200">
              Branded HTML
            </span>
          </div>
        </div>
      </div>

      {/* THREE EXECUTIVE ACTION CARDS (Monthly Reminders, Promos, Document Ready) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: Monthly Reminders */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                <Bell className="h-4 w-4 text-slate-700" />
                <span>Monthly Payment Reminders</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Automated Cycle
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Detect active instalment plans with due balances and broadcast personalized payment reminders via WhatsApp & Email.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Due Clients</span>
                <strong className="text-base font-bold text-slate-900">
                  {remindersPreview?.totalEligible ?? 0}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Total Due Cycle</span>
                <strong className="text-base font-bold text-slate-900">
                  {formatGHS(remindersPreview?.totalDueAmount || 0)}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setSelectedAllocationIds(dueCustomers.map((c: any) => c.allocationId));
                setIsDueRemindersModalOpen(true);
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Reminders</span>
            </button>
          </div>
        </div>

        {/* CARD 2: Promos & Site Launches */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                <Megaphone className="h-4 w-4 text-slate-700" />
                <span>Promos & Site Launches</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Marketing
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Broadcast special seasonal discounts, price incentives, or new site acquisition launches directly to registered clients.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Channels:</span>
                <strong className="text-slate-800">WhatsApp & HTML Email</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Audience:</span>
                <strong className="text-slate-800">All Registered Customers</strong>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsPromoModalOpen(true)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Megaphone className="h-3.5 w-3.5 text-slate-700" />
              <span>Broadcast Promo</span>
            </button>
          </div>
        </div>

        {/* CARD 3: Documents Ready for Collection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                <FileCheck className="h-4 w-4 text-slate-700" />
                <span>Documents Ready Alert</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Legal & Conveyance
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Send formal notifications confirming that Indentures, Site Plans, or Title Deeds are ready for client pickup at head office.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Collection Desk:</span>
                <strong className="text-slate-800 truncate max-w-[170px]" title="Ashaiman New Tulaku, Adjacent to New Tulaku Police Station">
                  Ashaiman New Tulaku
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verification:</span>
                <strong className="text-slate-800">Ghana Card Required</strong>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsDocReadyModalOpen(true)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <FileCheck className="h-3.5 w-3.5 text-slate-700" />
              <span>Notify Document Ready</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & AUDIT LOGS SECTION */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500 font-medium">Channel:</span>
            {['ALL', 'WHATSAPP', 'EMAIL'].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  channelFilter === ch
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium">Status:</span>
            {['ALL', 'DELIVERED', 'SENT', 'QUEUED', 'FAILED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {isLogsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No notification logs recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                Dispatches from Monthly Reminders, CRM, Payments, or Promos will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Event Trigger</th>
                    <th className="py-3 px-4">Recipient Client</th>
                    <th className="py-3 px-4">Channel & Destination</th>
                    <th className="py-3 px-4">Message Snippet</th>
                    <th className="py-3 px-4 text-center">Delivery Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {log.event.replace(/_/g, ' ')}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {new Date(log.createdAt).toLocaleString('en-GB')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold block text-slate-800">
                          {log.customer?.firstName} {log.customer?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {log.customer?.customerNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                          {log.channel === 'WHATSAPP' ? (
                            <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Mail className="h-3.5 w-3.5 text-slate-600" />
                          )}
                          <span>{log.recipientDestination}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs text-slate-600 truncate" title={log.messageContent}>
                        {log.messageContent}
                      </td>

                      <td className="py-3 px-4 text-center">{getStatusBadge(log.status)}</td>

                      <td className="py-3 px-4 text-center">
                        {log.status === 'FAILED' ? (
                          <button
                            type="button"
                            onClick={() => handleRetry(log.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px] cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {log.externalMessageId?.substring(0, 15) || 'OK'}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MODAL: MONTHLY PAYMENT REMINDERS PREVIEW & BATCH DISPATCH */}
      {/* ========================================================================= */}
      {isDueRemindersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-slate-200" />
                <span className="font-bold text-sm">
                  Monthly Instalment Reminders Dispatch
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDueRemindersModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              {remindersSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{remindersSuccessMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[11px]">Due Cycle Threshold</span>
                  <strong className="text-slate-900 font-bold">{remindersPreview?.dueDate || 'End of Month'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Eligible Clients</span>
                  <strong className="text-slate-900 font-bold">{dueCustomers.length} Customers</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Due Cycle</span>
                  <strong className="text-slate-900 font-bold">{formatGHS(remindersPreview?.totalDueAmount || 0)}</strong>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleToggleSelectAllDue}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                  >
                    {selectedAllocationIds.length === dueCustomers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {dueCustomers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">All customer instalments are fully up-to-date!</p>
                  <p className="text-slate-400 mt-1">No outstanding balances or due instalments found.</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Select</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Plot & Location</th>
                        <th className="py-2.5 px-3">Instalment Due</th>
                        <th className="py-2.5 px-3">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dueCustomers.map((c: any) => {
                        const isChecked = selectedAllocationIds.includes(c.allocationId);
                        return (
                          <tr
                            key={c.allocationId}
                            onClick={() => handleToggleAllocation(c.allocationId)}
                            className={`cursor-pointer transition-colors ${
                              isChecked ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 block">{c.customerName}</span>
                              <span className="text-[10px] text-slate-400">{c.telephone}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="block text-slate-800">{c.plotNumber}</span>
                              <span className="text-[10px] text-slate-400">{c.landLocation}</span>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {formatGHS(c.dueAmount)}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {formatGHS(c.outstandingBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  {selectedAllocationIds.length} of {dueCustomers.length} clients selected for reminder broadcast.
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsDueRemindersModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSendingReminders || selectedAllocationIds.length === 0}
                    onClick={handleBroadcastReminders}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isSendingReminders ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>{isSendingReminders ? 'Sending Broadcast...' : 'Dispatch Reminders'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL: PROMOTIONAL CAMPAIGN & SITE LAUNCH BROADCAST */}
      {/* ========================================================================= */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div className="flex items-center space-x-2">
                <Megaphone className="h-5 w-5 text-slate-200" />
                <span className="font-bold text-sm">
                  Broadcast Promotional Campaign / Site Announcement
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendPromo} className="p-6 space-y-4 text-xs text-slate-700">
              {promoSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{promoSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Campaign Headline / Subject *
                </label>
                <input
                  type="text"
                  required
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="e.g. Exclusive Site Launch: Phase 2 Prampram Coastal Plots"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Featured Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={promoLocation}
                    onChange={(e) => setPromoLocation(e.target.value)}
                    placeholder="e.g. Afienya (Greater Accra)"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Special Offer / Discount Terms (Optional)
                  </label>
                  <input
                    type="text"
                    value={promoOffer}
                    onChange={(e) => setPromoOffer(e.target.value)}
                    placeholder="e.g. GH₵ 5,000 Off Outright Settlement"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Announcement Message / Body *
                </label>
                <textarea
                  required
                  rows={4}
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  placeholder="Dear client, we are excited to introduce our new titled land acquisition site. Reserve your prime plot today with flexible installment plans..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500 font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Dispatch Channels
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ALL', label: 'WhatsApp & Email' },
                    { id: 'WHATSAPP', label: 'WhatsApp Only' },
                    { id: 'EMAIL', label: 'Email Only' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setPromoChannel(ch.id as any)}
                      className={`p-2 rounded-lg border text-center transition cursor-pointer font-semibold ${
                        promoChannel === ch.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingPromo}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSendingPromo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Megaphone className="h-3.5 w-3.5" />
                  )}
                  <span>{isSendingPromo ? 'Broadcasting...' : 'Broadcast to Clients'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: DOCUMENTS READY FOR COLLECTION ALERT */}
      {/* ========================================================================= */}
      {isDocReadyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div className="flex items-center space-x-2">
                <FileCheck className="h-5 w-5 text-slate-200" />
                <span className="font-bold text-sm">
                  Send Document Ready for Collection Notice
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDocReadyModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendDocReadyNotice} className="p-6 space-y-4 text-xs text-slate-700">
              {docNoticeSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{docNoticeSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Select Recipient Customer *
                </label>
                <select
                  required
                  value={docCustomerId}
                  onChange={(e) => setDocCustomerId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-500 font-medium text-slate-800"
                >
                  <option value="">-- Choose Customer --</option>
                  {rawCustomers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.customerNumber} - {c.telephone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Document Type(s) Prepared *
                </label>
                <input
                  type="text"
                  required
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder="Official Indenture & Cadastral Site Plan"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Collection Venue / Office
                  </label>
                  <input
                    type="text"
                    required
                    value={docCollectionOffice}
                    onChange={(e) => setDocCollectionOffice(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    required
                    value={docOfficeHours}
                    onChange={(e) => setDocOfficeHours(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 block">Notice will include:</span>
                <p>&bull; Document verification checklist (valid Ghana Card / Passport required).</p>
                <p>&bull; Automated dispatch to customer via Meta WhatsApp Business & verified HTML email.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDocReadyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingDocNotice}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSendingDocNotice ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{isSendingDocNotice ? 'Dispatching...' : 'Send Collection Alert'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
