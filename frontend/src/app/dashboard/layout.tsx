'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.replace('/login');
    }
  }, [mounted, user, isLoading, router]);

  if (!mounted || isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white" suppressHydrationWarning>
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          <p className="text-xs text-slate-400">Authenticating session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100" suppressHydrationWarning>
      <Sidebar isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onOpenNav={() => setIsMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
