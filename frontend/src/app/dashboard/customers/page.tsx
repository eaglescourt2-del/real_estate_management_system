'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import { WebcamCapture } from '../../../components/camera/webcam-capture';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Camera,
  Upload,
  FileText,
  DollarSign,
  Layers,
  CheckCircle,
  Eye,
  X,
  CreditCard,
} from 'lucide-react';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Registration Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [telephone, setTelephone] = useState('');
  const [altTelephone, setAltTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [gpsAddress, setGpsAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [idType, setIdType] = useState('GHANA_CARD');
  const [idNumber, setIdNumber] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');

  // Photo state (live webcam or file upload)
  const [photoSource, setPhotoSource] = useState<'NONE' | 'CAMERA_CAPTURE' | 'FILE_UPLOAD'>('NONE');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () =>
      apiRequest('/customers', {
        params: { search: searchTerm || undefined, limit: 50 },
      }),
  });

  // 2. Fetch Agents for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ['sales-agents'],
    queryFn: () => apiRequest('/users/agents'),
    enabled: isRegisterModalOpen && hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']),
  });

  const customers = customersData?.customers || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
        setPhotoSource('FILE_UPLOAD');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWebcamCapture = (base64Image: string) => {
    setPhotoBase64(base64Image);
    setPhotoSource('CAMERA_CAPTURE');
    setShowWebcam(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          otherNames: otherNames || undefined,
          telephone,
          altTelephone: altTelephone || undefined,
          email: email || undefined,
          residentialAddress,
          gpsAddress: gpsAddress || undefined,
          occupation: occupation || undefined,
          idType,
          idNumber: idNumber || undefined,
          assignedAgentId: assignedAgentId || undefined,
          photoSource: photoSource !== 'NONE' ? photoSource : undefined,
          photoBase64: photoBase64 || undefined,
        }),
      });

      setIsRegisterModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setOtherNames('');
    setTelephone('');
    setAltTelephone('');
    setEmail('');
    setResidentialAddress('');
    setGpsAddress('');
    setOccupation('');
    setIdNumber('');
    setAssignedAgentId('');
    setPhotoBase64(null);
    setPhotoSource('NONE');
    setShowWebcam(false);
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer CRM</h1>
          <p className="text-xs text-slate-500 mt-1">
            Internal client registration, biometrics, transaction ledger, and assigned sales agent tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsRegisterModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by client name, phone number (+233...), or Customer ID (CUST-202611-0001)..."
          className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-600">
            Clear
          </button>
        )}
      </div>

      {/* Customers Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No customer records found</p>
            <p className="text-xs text-slate-400 mt-1">Click "Register New Customer" to enroll your first client.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Client / Photo</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Ghana Card</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4 text-right">Agreed Value</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c: any) => {
                  const primaryPhoto = c.photographs?.[0]?.fileUrl;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {primaryPhoto ? (
                            <img
                              src={primaryPhoto}
                              alt={c.firstName}
                              className="h-9 w-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs border border-slate-200">
                              {c.firstName[0]}
                              {c.lastName[0]}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {c.firstName} {c.lastName} {c.otherNames || ''}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.customerNumber}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="space-y-0.5">
                          <p className="flex items-center space-x-1 font-medium text-slate-800">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{c.telephone}</span>
                          </p>
                          {c.email && (
                            <p className="flex items-center space-x-1 text-slate-400 text-[11px]">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{c.email}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium font-mono text-[11px]">
                        {c.idNumber || 'Not provided'}
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {c.assignedAgent ? (
                          <div>
                            <span className="font-semibold block text-slate-800">
                              {c.assignedAgent.firstName} {c.assignedAgent.lastName}
                            </span>
                            <span className="text-[10px] text-slate-400">{c.assignedAgent.telephone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatGHS(c.ledger?.totalAgreedPrice || 0)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-amber-600">
                        {formatGHS(c.ledger?.totalOutstandingBalance || 0)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Registration Dialog with Camera Biometrics */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Internal Customer Registration</h3>
                <p className="text-xs text-slate-500">Capture client biodata, Ghana Card, and biometric photograph.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-4 text-xs">
              {/* Photo Capture Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Customer Photograph (Webcam Snapshot or File Upload)
                </span>

                {showWebcam ? (
                  <WebcamCapture
                    onCapture={handleWebcamCapture}
                    onCancel={() => setShowWebcam(false)}
                  />
                ) : (
                  <div className="flex items-center space-x-4">
                    {photoBase64 ? (
                      <div className="relative">
                        <img
                          src={photoBase64}
                          alt="Customer preview"
                          className="h-20 w-20 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                        />
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-300">
                        <Camera className="h-8 w-8" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowWebcam(true)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>Capture from Device Camera</span>
                        </button>

                        <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Supports desktop webcams, tablet and mobile device cameras with permissions.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Biodata Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Kwame"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Mensah"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Other Names (Optional)</label>
                  <input
                    type="text"
                    value={otherNames}
                    onChange={(e) => setOtherNames(e.target.value)}
                    placeholder="Kofi"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Civil Engineer"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ghana Telephone *</label>
                  <input
                    type="tel"
                    required
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="0244123456 or +233244123456"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kwame.mensah@gmail.com"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">National ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="GHANA_CARD">Ghana Card (GHA-...)</option>
                    <option value="PASSPORT">Ghana Passport</option>
                    <option value="VOTER_ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="GHA-712345678-9"
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address *</label>
                <input
                  type="text"
                  required
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  placeholder="House No 14, East Legon, Accra"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              {/* Agent Assignment (For Super Admin / MD / Admin) */}
              {hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']) && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Agent</label>
                  <select
                    value={assignedAgentId}
                    onChange={(e) => setAssignedAgentId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Assign to Creator ({user?.firstName} {user?.lastName})</option>
                    {agents.map((ag: any) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.firstName} {ag.lastName} ({ag.telephone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                {selectedCustomer.photographs?.[0]?.fileUrl ? (
                  <img
                    src={selectedCustomer.photographs[0].fileUrl}
                    alt={selectedCustomer.firstName}
                    className="h-14 w-14 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-slate-900 text-amber-400 font-bold text-lg flex items-center justify-center">
                    {selectedCustomer.firstName[0]}
                    {selectedCustomer.lastName[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedCustomer.firstName} {selectedCustomer.lastName} {selectedCustomer.otherNames || ''}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedCustomer.customerNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Telephone</span>
                  <span className="font-semibold text-slate-800">{selectedCustomer.telephone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Email</span>
                  <span className="font-semibold text-slate-800">{selectedCustomer.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Residential Address</span>
                  <span className="font-semibold text-slate-800">{selectedCustomer.residentialAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Ghana Card ID</span>
                  <span className="font-semibold text-slate-800 font-mono">{selectedCustomer.idNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Financial Ledger Rollup */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">Financial Ledger Summary</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-slate-500 text-[10px]">Agreed Price</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {formatGHS(selectedCustomer.ledger?.totalAgreedPrice || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-slate-500 text-[10px]">Total Paid</span>
                    <p className="font-bold text-emerald-600 text-sm">
                      {formatGHS(selectedCustomer.ledger?.totalAmountPaid || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-slate-500 text-[10px]">Outstanding</span>
                    <p className="font-bold text-amber-600 text-sm">
                      {formatGHS(selectedCustomer.ledger?.totalOutstandingBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Allocated Plots */}
              {selectedCustomer.allocations && selectedCustomer.allocations.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-2">Allocated Plots</h4>
                  <div className="space-y-1.5">
                    {selectedCustomer.allocations.map((alloc: any) => (
                      <div
                        key={alloc.id}
                        className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{alloc.plot?.plotNumber}</span>
                          <span className="text-slate-500 text-[11px] ml-2">({alloc.plot?.landLocation?.name})</span>
                        </div>
                        <span className="font-semibold text-slate-800">{formatGHS(alloc.agreedPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

