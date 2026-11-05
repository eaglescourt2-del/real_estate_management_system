'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
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
} from 'lucide-react';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // 1. Fetch Notification Logs
  const { data: logsData, isLoading } = useQuery({
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

  // 2. Fetch Templates
  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => apiRequest('/notifications/templates'),
  });

  const logs = logsData?.records || [];

  const handleRetry = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/retry`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
    } catch (err: any) {
      alert(err?.message || 'Retry failed');
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const res = await apiRequest('/notifications/process-queue', { method: 'POST' });
      alert(`Queue processed: ${res.successful} sent, ${res.failed} failed.`);
      queryClient.invalidateQueries({ queryKey: ['notifications-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{status}</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">SENT</span>;
      case 'QUEUED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">QUEUED</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">FAILED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">WhatsApp & Email Delivery Logs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time delivery status, Meta webhook callbacks, idempotency tracking, and retry management.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleProcessQueue}
            disabled={isProcessingQueue}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{isProcessingQueue ? 'Processing...' : 'Run Queue Worker'}</span>
          </button>
        </div>
      </div>

      {/* Strict Anti-SMS Policy Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 flex items-start space-x-3 shadow-sm">
        <Smartphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wider text-[11px] text-slate-900">
            Channel Policy: WhatsApp Business & Resend Email Only:
          </span>
          <p className="mt-0.5 text-slate-600 leading-relaxed">
            In strict compliance with architectural constraints, <strong>SMS notifications are completely disabled</strong>.
            All client confirmations, receipts, invoices, and reminders are routed through authorized Meta WhatsApp Business messaging and responsive HTML email templates.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
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
                channelFilter === ch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No notification logs recorded</p>
            <p className="text-xs text-slate-400 mt-1">Dispatches from CRM, Payments, or Refunds will show here.</p>
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
                      <span className="text-[10px] text-slate-400 font-mono">{log.customer?.customerNumber}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                        {log.channel === 'WHATSAPP' ? (
                          <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Mail className="h-3.5 w-3.5 text-blue-600" />
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
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] cursor-pointer"
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
  );
}

