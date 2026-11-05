'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Building2, Bell, Shield, Coins } from 'lucide-react';

export function Header() {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiRequest('/settings/public'),
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            {settings?.companyName || 'Ghana Real Estate Developers'}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {settings?.companyTagline || 'Securing Your Land & Future with Trust'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Currency Tag */}
        <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
          <Coins className="h-3.5 w-3.5 text-amber-600" />
          <span>Currency: {settings?.currencySymbol || 'GH₵'} (GHS)</span>
        </div>

        {/* User Pill */}
        {user && (
          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
            <div className="h-8 w-8 rounded-full bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="hidden md:block text-left text-xs">
              <span className="font-semibold text-slate-800 block leading-tight">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-[10px] text-slate-500 font-medium capitalize">
                {user.role.toLowerCase().replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
