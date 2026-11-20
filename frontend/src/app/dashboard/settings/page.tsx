'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../contexts/auth-context';
import {
  Settings,
  Building,
  Mail,
  Phone,
  MapPin,
  Coins,
  CheckCircle,
  Save,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyTagline, setCompanyTagline] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('GHS');
  const [currencySymbol, setCurrencySymbol] = useState('GH₵');
  const [emailFromAddress, setEmailFromAddress] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch Current Settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings-admin'],
    queryFn: () => apiRequest('/settings'),
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setCompanyTagline(settings.companyTagline || '');
      setCompanyEmail(settings.companyEmail || '');
      setCompanyPhone(settings.companyPhone || '');
      setCompanyAddress(settings.companyAddress || '');
      setDefaultCurrency(settings.defaultCurrency || 'GHS');
      setCurrencySymbol(settings.currencySymbol || 'GH₵');
      setEmailFromAddress(settings.emailFromAddress || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          companyName,
          companyTagline,
          companyEmail,
          companyPhone,
          companyAddress,
          defaultCurrency,
          currencySymbol,
          emailFromAddress,
        }),
      });

      setStatusMessage({ type: 'success', text: 'System white-label settings updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-settings-admin'] });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to update system settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (user && user.role !== 'SUPER_ADMINISTRATOR') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto mt-12">
        <div className="p-4 bg-amber-100 text-amber-700 rounded-full mb-4">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Super Administrator Access Only</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          System & White-Label settings are strictly restricted to the Super Administrator account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System & White-Label Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure dynamic corporate identity, branding, Ghanaian currency symbols, and notification from-headers.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center space-x-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Corporate Identity & Branding
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Legal Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Tagline / Motto</label>
              <input
                type="text"
                value={companyTagline}
                onChange={(e) => setCompanyTagline(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Corporate Email Address *</label>
              <input
                type="email"
                required
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Corporate Phone Number *</label>
              <input
                type="text"
                required
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Head Office Physical Address</label>
            <input
              type="text"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Ghanaian Financial & Currency Formatting
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Code *</label>
              <input
                type="text"
                required
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Symbol *</label>
              <input
                type="text"
                required
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notification Sender Address</label>
              <input
                type="text"
                value={emailFromAddress}
                onChange={(e) => setEmailFromAddress(e.target.value)}
                placeholder="receipts@realestatedev.gh"
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

