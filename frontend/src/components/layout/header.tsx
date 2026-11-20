'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Coins, Menu, KeyRound } from 'lucide-react';
import { ChangePasswordModal } from '../auth/change-password-modal';

interface HeaderProps {
  onOpenNav?: () => void;
}

export function Header({ onOpenNav }: HeaderProps) {
  const { user } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => apiRequest('/settings').catch(() => null),
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={onOpenNav}
          className="p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate">
            {settings?.companyName || 'Ghana Real Estate Developers'}
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate hidden sm:block">
            {settings?.companyTagline || 'Securing Your Land & Future with Trust'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
        {/* Currency Tag */}
        <div className="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
          <Coins className="h-3.5 w-3.5 text-amber-600" />
          <span>Currency: {settings?.currencySymbol || 'GH₵'} (GHS)</span>
        </div>

        {/* User Pill */}
        {user && (
          <div className="flex items-center space-x-1 sm:space-x-2 pl-2 sm:pl-3 border-l border-slate-200">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
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

            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              title="Change Password"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
}
