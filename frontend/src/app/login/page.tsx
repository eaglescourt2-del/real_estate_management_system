'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/auth-context';
import { Building2, ShieldCheck, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Left Branding Showcase */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-r border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500 rounded-xl text-slate-950 shadow-lg shadow-amber-500/20">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Real Estate System</h1>
            <p className="text-xs text-amber-400 font-medium">Internal Management Portal &bull; Ghana</p>
          </div>
        </div>

        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Strict Role-Based Access Control</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
            Centralized Land Sales, Plot Inventory & Financial Oversight.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Authorized staff platform for managing customer biometrics, plot subdivisions, receipt generation,
            landowner obligations, daily revenue ledgers, and automated WhatsApp & Email updates.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-200 block">Mutual Exclusivity Engine</span>
              Full vs half plot allocation locks
            </div>
            <div>
              <span className="font-semibold text-slate-200 block">External Payment Reconciliation</span>
              MoMo, Bank, Direct Cash & Cheques
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Enterprise Real Estate Tech</span>
          <span>Secured with Argon2id & Dual JWT</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="lg:hidden flex items-center space-x-2 mb-6">
              <div className="p-2 bg-amber-500 rounded-lg text-slate-950">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-bold text-white">Real Estate System</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Staff Authentication</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in with your authorized corporate email and password.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start space-x-3 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Authentication Failed</p>
                <p className="text-xs mt-0.5 text-red-300">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@realestatedev.gh"
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-700 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-700 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Pills */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              One-Click Role Profiles (Seed Credentials):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoCredentials('superadmin@realestatedev.gh', 'SuperAdminPassword2026!')}
                className="p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition-colors cursor-pointer"
              >
                <span className="font-semibold text-amber-400 block">Super Administrator</span>
                <span className="text-slate-400 text-[11px]">All modules & overrides</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('md@realestatedev.gh', 'DirectorPassword2026!')}
                className="p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition-colors cursor-pointer"
              >
                <span className="font-semibold text-emerald-400 block">Managing Director</span>
                <span className="text-slate-400 text-[11px]">Refunds & large expenses</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@realestatedev.gh', 'AdminPassword2026!')}
                className="p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition-colors cursor-pointer"
              >
                <span className="font-semibold text-blue-400 block">Administrator</span>
                <span className="text-slate-400 text-[11px]">Operations & plots</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('agent.boateng@realestatedev.gh', 'AgentPassword2026!')}
                className="p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition-colors cursor-pointer"
              >
                <span className="font-semibold text-purple-400 block">Sales Agent</span>
                <span className="text-slate-400 text-[11px]">Assigned customers</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
