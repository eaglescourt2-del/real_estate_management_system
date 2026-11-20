'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  MapPin,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Ban,
  Tag,
  Info,
  DollarSign,
  Maximize2,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  PieChart,
} from 'lucide-react';

const GHANA_REGIONS = [
  'Greater Accra',
  'Central',
  'Eastern',
  'Ashanti',
  'Western',
  'Volta',
  'Northern',
  'Upper East',
  'Upper West',
  'Oti',
  'Bono',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Western North',
];

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Modal Visibility States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBatchGenerateModalOpen, setIsBatchGenerateModalOpen] = useState(false);

  // Form state: Add/Edit Land Location
  const [locationName, setLocationName] = useState('');
  const [region, setRegion] = useState('Greater Accra');
  const [district, setDistrict] = useState('');
  const [geographicalAddress, setGeographicalAddress] = useState('');
  const [landSizeAcres, setLandSizeAcres] = useState<number | string>(10);
  const [totalPlotsCount, setTotalPlotsCount] = useState<number | string>(40);
  const [landownerName, setLandownerName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | string>('');
  const [fullPlotPrice, setFullPlotPrice] = useState<number | string>(50000);
  const [halfPlotPrice, setHalfPlotPrice] = useState<number | string>(28000);
  const [dimensionsDesc, setDimensionsDesc] = useState('70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)');

  // Batch Plot Generation Form State
  const [startPlotNum, setStartPlotNum] = useState<number>(1);
  const [endPlotNum, setEndPlotNum] = useState<number>(40);
  const [includeHalfPlots, setIncludeHalfPlots] = useState<boolean>(true);

  // Action status / feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch All Land Locations
  const { data: locations = [], isLoading: isLocationsLoading } = useQuery({
    queryKey: ['land-locations'],
    queryFn: async () => {
      const res = await apiRequest('/land-locations');
      if (res && res.length > 0 && !selectedLocationId) {
        setSelectedLocationId(res[0].id);
      }
      return res;
    },
  });

  const selectedLocation = locations.find((l: any) => l.id === selectedLocationId);

  // 2. Fetch Selected Location Breakdown (Total, Sold, Left)
  const { data: breakdownData, isLoading: isBreakdownLoading } = useQuery({
    queryKey: ['location-breakdown', selectedLocationId],
    queryFn: () => apiRequest(`/land-locations/${selectedLocationId}/inventory-breakdown`),
    enabled: !!selectedLocationId,
  });

  // Auto-calculate suggested plots when acres change (standard 4 full plots per acre in Ghana)
  const handleAcresChange = (val: number | string) => {
    setLandSizeAcres(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      setTotalPlotsCount(Math.round(num * 4));
    }
  };

  // Open Edit Modal and prefill with current data
  const handleOpenEditModal = () => {
    if (!selectedLocation) return;
    setLocationName(selectedLocation.name || '');
    setRegion(selectedLocation.region || 'Greater Accra');
    setDistrict(selectedLocation.district || '');
    setGeographicalAddress(selectedLocation.geographicalAddress || '');
    setLandSizeAcres(Number(selectedLocation.totalLandSizeAcres) || 0);
    setTotalPlotsCount(selectedLocation.totalPlotsCount || 0);
    setLandownerName(selectedLocation.landownerName || '');
    setPurchasePrice(selectedLocation.purchasePrice ? Number(selectedLocation.purchasePrice) : '');
    setFullPlotPrice(Number(selectedLocation.standardFullPlotPrice) || 0);
    setHalfPlotPrice(Number(selectedLocation.standardHalfPlotPrice) || 0);
    setDimensionsDesc(selectedLocation.plotDimensionsDesc || '70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Add Modal with fresh defaults
  const handleOpenAddModal = () => {
    setLocationName('');
    setRegion('Greater Accra');
    setDistrict('');
    setGeographicalAddress('');
    setLandSizeAcres(10);
    setTotalPlotsCount(40);
    setLandownerName('');
    setPurchasePrice('');
    setFullPlotPrice(50000);
    setHalfPlotPrice(28000);
    setDimensionsDesc('70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Submit: Add New Location
  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: locationName.trim(),
        region: region.trim(),
        district: district.trim(),
        geographicalAddress: geographicalAddress.trim(),
        totalLandSizeAcres: Number(landSizeAcres),
        totalPlotsCount: Number(totalPlotsCount),
        landownerName: landownerName.trim() || undefined,
        purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : undefined,
        standardFullPlotPrice: Number(fullPlotPrice),
        standardHalfPlotPrice: Number(halfPlotPrice),
        plotDimensionsDesc: dimensionsDesc.trim() || undefined,
      };

      const res = await apiRequest('/land-locations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsAddModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      if (res?.id) {
        setSelectedLocationId(res.id);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to add land location');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Edit Location
  const handleEditLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: locationName.trim(),
        region: region.trim(),
        district: district.trim(),
        geographicalAddress: geographicalAddress.trim(),
        totalLandSizeAcres: Number(landSizeAcres),
        totalPlotsCount: Number(totalPlotsCount),
        landownerName: landownerName.trim() || undefined,
        purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : undefined,
        standardFullPlotPrice: Number(fullPlotPrice),
        standardHalfPlotPrice: Number(halfPlotPrice),
        plotDimensionsDesc: dimensionsDesc.trim() || undefined,
      };

      await apiRequest(`/land-locations/${selectedLocationId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      queryClient.invalidateQueries({ queryKey: ['location-breakdown', selectedLocationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update land location');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Delete Location
  const handleDeleteLocationSubmit = async () => {
    if (!selectedLocationId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/land-locations/${selectedLocationId}`, {
        method: 'DELETE',
      });

      setIsDeleteModalOpen(false);
      setSelectedLocationId('');
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete land location');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Batch Generate Plots
  const handleBatchGeneratePlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/land-locations/${selectedLocationId}/batch-generate-plots`, {
        method: 'POST',
        body: JSON.stringify({
          startPlotNumber: Number(startPlotNum),
          endPlotNumber: Number(endPlotNum),
          includeHalfPlots,
          fullPlotDimensions: '70ft x 100ft',
          halfPlotDimensions: '50ft x 70ft',
        }),
      });

      setIsBatchGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['plots', selectedLocationId] });
      queryClient.invalidateQueries({ queryKey: ['location-breakdown', selectedLocationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to batch generate plots');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const inventoryStats = breakdownData?.inventory || {
    totalPlots: selectedLocation?.totalPlotsCount || 0,
    plotsSold: 0,
    plotsLeft: selectedLocation?.totalPlotsCount || 0,
    availablePlots: 0,
    reservedPlots: 0,
    partiallySoldPlots: 0,
    soldPlots: 0,
    occupancyRatePercentage: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Land & Plot Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete management of acquisition sites, land size in acres, landowner information, and live plot sales availability.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasRole(['SUPER_ADMINISTRATOR', 'ADMINISTRATOR']) && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Land Location</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Location Selector & Primary Attribute Banner */}
      {locations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Land Locations Registered Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Get started by adding your first land acquisition site with total acreage, landowner name, and standard selling prices.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center space-x-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-semibold text-slate-950 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register First Land Location</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Location Selection & Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Select Land Location / Estate
                </label>
                <div className="flex items-center space-x-3">
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {locations.map((loc: any) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} — {Number(loc.totalLandSizeAcres)} Acres ({loc.region})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons for Selected Location */}
              {hasRole(['SUPER_ADMINISTRATOR', 'ADMINISTRATOR']) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleOpenEditModal}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Edit Location</span>
                  </button>
                  <button
                    onClick={() => {
                      setStartPlotNum(1);
                      setEndPlotNum(selectedLocation?.totalPlotsCount || 40);
                      setIsBatchGenerateModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-900 transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>Batch Generate Plots</span>
                  </button>
                  <button
                    onClick={() => {
                      setFormError(null);
                      setIsDeleteModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span>Delete Location</span>
                  </button>
                </div>
              )}
            </div>

            {/* Detailed Parameters Grid */}
            {selectedLocation && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Land Size (Acres)</span>
                  <span className="text-slate-900 font-bold text-sm">
                    {Number(selectedLocation.totalLandSizeAcres)} Acres
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Landowner's Name</span>
                  <span className="text-slate-900 font-bold text-sm truncate block" title={selectedLocation.landownerName || 'Not specified'}>
                    {selectedLocation.landownerName || 'Direct / Undisclosed'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Acquisition / Purchase Price</span>
                  <span className="text-slate-900 font-bold text-sm text-emerald-700">
                    {selectedLocation.purchasePrice ? formatGHS(selectedLocation.purchasePrice) : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Full Plot Selling Price</span>
                  <span className="text-slate-900 font-bold text-sm text-blue-700">
                    {formatGHS(selectedLocation.standardFullPlotPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Half Plot Selling Price</span>
                  <span className="text-slate-900 font-bold text-sm text-purple-700">
                    {formatGHS(selectedLocation.standardHalfPlotPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">District & Region</span>
                  <span className="text-slate-900 font-bold text-xs truncate block" title={`${selectedLocation.district}, ${selectedLocation.region}`}>
                    {selectedLocation.district}, {selectedLocation.region}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. The 3 Primary Live Counters: Total Plots, Plots Sold, Plots Left & Sales Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Plots */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Number of Plots</span>
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-slate-900">{inventoryStats.totalPlots}</span>
                <span className="text-xs text-slate-500">Planned Plots</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Total capacity for this site</p>
            </div>

            {/* Plots Sold */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Number of Plots Sold</span>
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-blue-900">{inventoryStats.plotsSold}</span>
                <span className="text-xs text-blue-700">Sold / Paid</span>
              </div>
              <p className="text-[11px] text-blue-600 mt-1">
                {inventoryStats.soldPlots} Full Plots + {inventoryStats.partiallySoldPlots} Half Plots
              </p>
            </div>

            {/* Plots Left */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Number of Plots Left</span>
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Tag className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-900">{inventoryStats.plotsLeft}</span>
                <span className="text-xs text-emerald-700">Available</span>
              </div>
              <p className="text-[11px] text-emerald-600 mt-1">Ready for immediate client allocation</p>
            </div>

            {/* Occupancy Rate */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Sales Progress</span>
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <PieChart className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-purple-900">
                  {inventoryStats.occupancyRatePercentage}%
                </span>
                <span className="text-xs text-purple-700">Occupied</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(inventoryStats.occupancyRatePercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD LAND LOCATION */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Add New Land Acquisition Site</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddLocationSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Land Location / Estate Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g. Prampram Palms Phase 2"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Region *
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  >
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    District / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Ningo-Prampram"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Geographical Address & Landmarks *
                  </label>
                  <input
                    type="text"
                    required
                    value={geographicalAddress}
                    onChange={(e) => setGeographicalAddress(e.target.value)}
                    placeholder="e.g. Near Central University, Dawhenya-Prampram Road"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Land Size (in Acres) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={landSizeAcres}
                    onChange={(e) => handleAcresChange(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Number of Plots *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalPlotsCount}
                    onChange={(e) => setTotalPlotsCount(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Land Owner's Name
                  </label>
                  <input
                    type="text"
                    value={landownerName}
                    onChange={(e) => setLandownerName(e.target.value)}
                    placeholder="e.g. Nii Ayiku Mensah Family Stool"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Acquisition / Purchase Price (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="e.g. 600000"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Plot Selling Price (GH₵) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={fullPlotPrice}
                    onChange={(e) => setFullPlotPrice(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Half Plot Selling Price (GH₵) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={halfPlotPrice}
                    onChange={(e) => setHalfPlotPrice(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Save Land Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT LAND LOCATION */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Edit Land Location</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditLocationSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Land Location / Estate Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Region *
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  >
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    District / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Geographical Address & Landmarks *
                  </label>
                  <input
                    type="text"
                    required
                    value={geographicalAddress}
                    onChange={(e) => setGeographicalAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Land Size (in Acres) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={landSizeAcres}
                    onChange={(e) => setLandSizeAcres(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Number of Plots *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalPlotsCount}
                    onChange={(e) => setTotalPlotsCount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Land Owner's Name
                  </label>
                  <input
                    type="text"
                    value={landownerName}
                    onChange={(e) => setLandownerName(e.target.value)}
                    placeholder="e.g. Nii Ayiku Mensah Family Stool"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Acquisition / Purchase Price (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Plot Selling Price (GH₵) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={fullPlotPrice}
                    onChange={(e) => setFullPlotPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Half Plot Selling Price (GH₵) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={halfPlotPrice}
                    onChange={(e) => setHalfPlotPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE LOCATION CONFIRMATION */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Land Location</h3>
                <p className="text-xs text-slate-500">Permanent removal with cascade safety</p>
              </div>
            </div>

            {formError ? (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Are you sure you want to delete <strong className="text-slate-900">{selectedLocation?.name}</strong>?
                This will safely remove available plots. Locations containing already sold, partially sold, or reserved plots cannot be deleted.
              </p>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLocationSubmit}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH GENERATE PLOTS */}
      {/* ========================================================================= */}
      {isBatchGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Batch Generate Plots</h3>
              </div>
              <button
                onClick={() => setIsBatchGenerateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleBatchGeneratePlots} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Generate sequential plot numbers for <strong className="text-slate-800">{selectedLocation?.name}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={startPlotNum}
                    onChange={(e) => setStartPlotNum(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={endPlotNum}
                    onChange={(e) => setEndPlotNum(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="includeHalf"
                  checked={includeHalfPlots}
                  onChange={(e) => setIncludeHalfPlots(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
                <label htmlFor="includeHalf" className="text-xs text-slate-700 cursor-pointer">
                  Auto-create Child Half-Plots (e.g. Plot 1A & Plot 1B)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBatchGenerateModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Generating...' : `Generate ${endPlotNum - startPlotNum + 1} Plots`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
