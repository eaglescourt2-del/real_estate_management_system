'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../contexts/auth-context';
import {
  Users,
  UserPlus,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Search,
  Trash2,
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string;
  telephone: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMINISTRATOR' | 'MANAGING_DIRECTOR' | 'ADMINISTRATOR' | 'SALES_AGENT';
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedStaffForReset, setSelectedStaffForReset] = useState<StaffUser | null>(null);

  // New Staff Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SALES_AGENT' | 'ADMINISTRATOR' | 'MANAGING_DIRECTOR' | 'SUPER_ADMINISTRATOR'>('SALES_AGENT');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password State
  const [newTempPassword, setNewTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Delete Staff State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStaffForDelete, setSelectedStaffForDelete] = useState<StaffUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all staff users
  const { data: staffList = [], isLoading, error: fetchError } = useQuery<StaffUser[]>({
    queryKey: ['staff-users-list'],
    queryFn: () => apiRequest('/auth/users'),
    enabled: user?.role === 'SUPER_ADMINISTRATOR',
  });

  // Guard: Super Admin Only
  if (user && user.role !== 'SUPER_ADMINISTRATOR') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto mt-12">
        <div className="p-4 bg-amber-100 text-amber-700 rounded-full mb-4">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Super Administrator Access Required</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Staff provisioning, role assignments, and access control are strictly restricted to the Super Administrator account.
        </p>
      </div>
    );
  }

  // Handle Register New Staff
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (password.length < 8) {
      setRegError('Temporary password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/auth/register-staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          telephone: telephone.trim(),
          email: email.trim().toLowerCase(),
          role,
          password,
        }),
      });

      setRegSuccess(res.message || 'Staff member provisioned successfully!');
      queryClient.invalidateQueries({ queryKey: ['staff-users-list'] });

      setTimeout(() => {
        setIsRegisterModalOpen(false);
        setFirstName('');
        setLastName('');
        setTelephone('');
        setEmail('');
        setPassword('');
        setRegSuccess(null);
      }, 1500);
    } catch (err: any) {
      setRegError(err?.message || 'Failed to provision staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active/Suspended Status
  const handleToggleStatus = async (staff: StaffUser) => {
    if (staff.id === user?.id) {
      alert('You cannot suspend your own administrative account.');
      return;
    }

    const nextStatus = staff.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = staff.status === 'ACTIVE'
      ? `Are you sure you want to suspend access for ${staff.firstName} ${staff.lastName}? They will not be able to log in.`
      : `Reactivate login access for ${staff.firstName} ${staff.lastName}?`;

    if (!confirm(confirmMsg)) return;

    try {
      await apiRequest(`/auth/users/${staff.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-users-list'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to update staff status.');
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForReset) return;
    setResetError(null);
    setResetSuccess(null);

    if (newTempPassword.length < 8) {
      setResetError('Temporary password must be at least 8 characters long.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await apiRequest(`/auth/users/${selectedStaffForReset.id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: newTempPassword }),
      });

      setResetSuccess(res.message || 'Password reset successfully!');
      setTimeout(() => {
        setIsResetModalOpen(false);
        setSelectedStaffForReset(null);
        setNewTempPassword('');
        setResetSuccess(null);
      }, 1500);
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset staff password.');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Delete Staff
  const handleDeleteStaff = async () => {
    if (!selectedStaffForDelete) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await apiRequest(`/auth/users/${selectedStaffForDelete.id}`, {
        method: 'DELETE',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-users-list'] });
      setIsDeleteModalOpen(false);
      setSelectedStaffForDelete(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete staff member.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered List
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.telephone.includes(searchTerm);

    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (r: StaffUser['role']) => {
    switch (r) {
      case 'SUPER_ADMINISTRATOR':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Super Admin</span>;
      case 'MANAGING_DIRECTOR':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Managing Director</span>;
      case 'ADMINISTRATOR':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Administrator</span>;
      case 'SALES_AGENT':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Sales Agent</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">{r}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Users className="h-6 w-6 text-amber-600" />
            <span>Staff Accounts & Access Provisioning</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Super Administrator dashboard for registering staff members, assigning role-based permissions, and managing credentials.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsRegisterModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm shadow-amber-500/20 cursor-pointer transition-all shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>Provision New Staff</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{staffList.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Accounts</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {staffList.filter((s) => s.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suspended</p>
          <p className="text-2xl font-black text-red-600 mt-1">
            {staffList.filter((s) => s.status === 'SUSPENDED').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sales Agents</p>
          <p className="text-2xl font-black text-purple-600 mt-1">
            {staffList.filter((s) => s.role === 'SALES_AGENT').length}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or telephone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-600">Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMINISTRATOR">Super Administrator</option>
            <option value="MANAGING_DIRECTOR">Managing Director</option>
            <option value="ADMINISTRATOR">Administrator</option>
            <option value="SALES_AGENT">Sales Agent</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No staff members found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Telephone</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {staff.firstName[0]}
                          {staff.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">
                            {staff.firstName} {staff.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{staff.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{staff.telephone}</td>
                    <td className="py-3.5 px-4">{getRoleBadge(staff.role)}</td>
                    <td className="py-3.5 px-4">
                      {staff.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          <span>Suspended</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString('en-GB') : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-2">
                        {/* Reset Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaffForReset(staff);
                            setIsResetModalOpen(true);
                          }}
                          title="Reset Password"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>

                        {/* Toggle Status Button (Only for other users) */}
                        {staff.id !== user?.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(staff)}
                              title={staff.status === 'ACTIVE' ? 'Suspend Login' : 'Activate Login'}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                staff.status === 'ACTIVE'
                                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {staff.status === 'ACTIVE' ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Delete Staff Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffForDelete(staff);
                                setDeleteError(null);
                                setIsDeleteModalOpen(true);
                              }}
                              title="Delete Staff Account"
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: PROVISION NEW STAFF */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Provision New Staff Account</h3>
                  <p className="text-xs text-slate-500">Create login credentials and assign role permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {regError && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterStaff} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Kwame"
                    className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mensah"
                    className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telephone Number *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="e.g. +233244123456"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email Address *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. kmensah@realestatedev.gh"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="SALES_AGENT">Sales Agent (Customer Onboarding & Plots)</option>
                  <option value="ADMINISTRATOR">Administrator (Operations, Deeds & Payments)</option>
                  <option value="MANAGING_DIRECTOR">Managing Director (Executive Dashboard & Financials)</option>
                  <option value="SUPER_ADMINISTRATOR">Super Administrator (Full System Authority)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temporary Initial Password * (Min 8 characters)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create temporary password"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  The staff member will use this password to sign in and can change it to their own private password anytime.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 cursor-pointer transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET STAFF PASSWORD */}
      {isResetModalOpen && selectedStaffForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Staff Password</h3>
                  <p className="text-xs text-slate-500">
                    Set a new temporary password for {selectedStaffForReset.firstName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false);
                  setSelectedStaffForReset(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resetError && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                <p>
                  <strong>Staff Member:</strong> {selectedStaffForReset.firstName} {selectedStaffForReset.lastName}
                </p>
                <p className="text-slate-500 mt-0.5">
                  <strong>Email:</strong> {selectedStaffForReset.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Temporary Password * (Min 8 characters)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showTempPassword ? 'text' : 'password'}
                    required
                    value={newTempPassword}
                    onChange={(e) => setNewTempPassword(e.target.value)}
                    placeholder="Enter new temporary password"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showTempPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setSelectedStaffForReset(null);
                  }}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 cursor-pointer transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM DELETE STAFF */}
      {isDeleteModalOpen && selectedStaffForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Staff Account</h3>
                  <p className="text-xs text-slate-500">Permanently remove staff access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStaffForDelete(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deleteError && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">
                  {selectedStaffForDelete.firstName} {selectedStaffForDelete.lastName}
                </strong>{' '}
                (<span className="font-mono text-slate-700">{selectedStaffForDelete.email}</span>)?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <p className="font-semibold text-[11px] uppercase tracking-wider text-amber-800">
                  Data Safety & Compliance Notice:
                </p>
                <p className="text-[11px] leading-relaxed">
                  This user will no longer be able to log in. Any historical customer records or payment entries authored by this staff member will be preserved and reassigned to the Super Administrator.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStaffForDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer transition-all shadow-sm shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Staff Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
