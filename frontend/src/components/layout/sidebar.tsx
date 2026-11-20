'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, UserRole } from '../../contexts/auth-context';
import {
  LayoutDashboard,
  MapPin,
  Users,
  CreditCard,
  Building,
  RotateCcw,
  Wallet,
  MessageSquare,
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  X,
  KeyRound,
} from 'lucide-react';
import { ChangePasswordModal } from '../auth/change-password-modal';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Executive Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR', 'SALES_AGENT'],
  },
  {
    title: 'Land & Plot Inventory',
    href: '/dashboard/inventory',
    icon: MapPin,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR', 'SALES_AGENT'],
  },
  {
    title: 'Customer CRM',
    href: '/dashboard/customers',
    icon: Users,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR', 'SALES_AGENT'],
  },
  {
    title: 'Customer Payments',
    href: '/dashboard/payments',
    icon: CreditCard,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR'],
  },
  {
    title: 'Landowner Obligations',
    href: '/dashboard/landowners',
    icon: Building,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR'],
  },
  {
    title: 'Refund Workflow',
    href: '/dashboard/refunds',
    icon: RotateCcw,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR'],
  },
  {
    title: 'Daily Financials & P&L',
    href: '/dashboard/financials',
    icon: Wallet,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR'],
  },
  {
    title: 'WhatsApp & Email Logs',
    href: '/dashboard/notifications',
    icon: MessageSquare,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR'],
  },
  {
    title: 'Staff Accounts',
    href: '/dashboard/staff',
    icon: Users,
    roles: ['SUPER_ADMINISTRATOR'],
  },
  {
    title: 'System Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['SUPER_ADMINISTRATOR'],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const filteredNavItems = NAV_ITEMS.filter((item) => hasRole(item.roles));

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case 'SUPER_ADMINISTRATOR':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MANAGING_DIRECTOR':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ADMINISTRATOR':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'SALES_AGENT':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="overflow-y-auto">
          {/* Sidebar Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-9 w-9 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center shadow-xs">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="truncate">
                <span className="font-bold text-xs text-white tracking-tight block truncate">Potential Investment</span>
                <span className="block text-[10px] text-amber-400 font-semibold truncate">
                  Real Estate Ltd.
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 lg:hidden cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Card */}
          {user && (
            <div className="p-3.5 mx-3 my-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400 text-xs border border-slate-700 shrink-0">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <div
                    className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-medium border truncate ${getRoleBadgeColor(
                      user.role,
                    )}`}
                  >
                    {user.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-slate-950 shrink-0" />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-1">
          <button
            onClick={() => {
              onClose?.();
              setIsPasswordModalOpen(true);
            }}
            type="button"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
          >
            <KeyRound className="h-4 w-4" />
            <span>Change Password</span>
          </button>
          <button
            onClick={() => {
              onClose?.();
              logout();
            }}
            type="button"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
}
