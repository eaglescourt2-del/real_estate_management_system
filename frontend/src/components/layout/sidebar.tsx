'use client';

import React from 'react';
import Link from 'next/navigation';
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
} from 'lucide-react';

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
    title: 'System Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();

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
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500 rounded-lg text-slate-950 font-bold">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-tight">Real Estate Portal</span>
              <span className="block text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                Ghana Operations
              </span>
            </div>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="p-4 mx-3 my-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400 text-xs border border-slate-700">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <div
                  className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-medium border ${getRoleBadgeColor(
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
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.title}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-slate-950" />}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer Sign Out */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
