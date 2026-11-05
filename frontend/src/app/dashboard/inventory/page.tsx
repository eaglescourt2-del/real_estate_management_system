'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { formatGHS } from '../../../lib/utils';
import { useAuth } from '../../../contexts/auth-context';
import {
  MapPin,
  Layers,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  Ban,
  Tag,
  Info,
  DollarSign,
  Maximize2,
} from 'lucide-react';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedPlot, setSelectedPlot] = useState<any>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Form states for batch generation
  const [batchLocationId, setBatchLocationId] = useState('');
  const [baseCount, setBaseCount] = useState(50);
  const [fullPrice, setFullPrice] = useState(80000);
  const [halfPrice, setHalfPrice] = useState(45000);
  const [dimensions, setDimensions] = useState('70 x 100 ft');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 1. Fetch Locations
  const { data: locations = [], isLoading: isLocationsLoading } = useQuery({
    queryKey: ['land-locations'],
    queryFn: async () => {
      const res = await apiRequest('/land-locations');
      if (res && res.length > 0 && !selectedLocationId) {
        setSelectedLocationId(res[0].id);
        setBatchLocationId(res[0].id);
      }
      return res;
    },
  });

  // 2. Fetch Plots for Selected Location
  const { data: plotsData, isLoading: isPlotsLoading } = useQuery({
    queryKey: ['plots', selectedLocationId, statusFilter],
    queryFn: () =>
      apiRequest('/plots', {
        params: {
          landLocationId: selectedLocationId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          limit: 200,
        },
      }),
    enabled: !!selectedLocationId,
  });

  const plots = plotsData?.plots || [];

  // Batch generate plots
  const handleBatchGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);

    try {
      await apiRequest('/plots/batch-generate', {
        method: 'POST',
        body: JSON.stringify({
          landLocationId: batchLocationId,
          basePlotCount: Number(baseCount),
          dimensions,
          fullPlotPrice: Number(fullPrice),
          halfPlotPrice: Number(halfPrice),
        }),
      });

      setIsGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate plots');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">AVAILABLE</span>;
      case 'PARTIALLY_SOLD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">PARTIALLY SOLD</span>;
      case 'RESERVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">RESERVED</span>;
      case 'SOLD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">SOLD</span>;
      case 'BLOCKED':
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">BLOCKED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const getPlotCardBg = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-white hover:border-emerald-500 border-slate-200';
      case 'PARTIALLY_SOLD':
        return 'bg-purple-50/40 hover:border-purple-500 border-purple-200';
      case 'RESERVED':
        return 'bg-amber-50/40 hover:border-amber-500 border-amber-200';
      case 'SOLD':
        return 'bg-blue-50/40 hover:border-blue-500 border-blue-200';
      case 'BLOCKED':
      case 'CANCELLED':
        return 'bg-slate-100 opacity-60 border-slate-300';
      default:
        return 'bg-white border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Land & Plot Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Visual plot numbering (Plot 1, Plot 1A, Plot 1B), allocation status, and mutual exclusivity locks.
          </p>
        </div>
        {hasRole(['SUPER_ADMINISTRATOR', 'ADMINISTRATOR']) && (
          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Plots</span>
          </button>
        )}
      </div>

      {/* Location Selector Ribbon */}
      <div className="flex flex-wrap gap-2 pt-2">
        {locations.map((loc: any) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setSelectedLocationId(loc.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              selectedLocationId === loc.id
                ? 'bg-slate-900 text-white border-slate-900 shadow'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MapPin className={`h-4 w-4 ${selectedLocationId === loc.id ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>{loc.name}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                selectedLocationId === loc.id ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {loc.totalPlotsCount || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Mutual Exclusivity Guide Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start space-x-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wider text-[11px] text-blue-950">
            Full-Plot & Half-Plot Mutual Exclusivity Engine:
          </span>
          <p className="mt-0.5 text-blue-800 leading-relaxed">
            Allocating a full plot (e.g. <strong>Plot 1</strong>) automatically blocks both half plots (<strong>1A & 1B</strong>).
            Conversely, selling <strong>Plot 1A</strong> automatically marks Plot 1 as <em>Partially Sold</em> while keeping <strong>Plot 1B</strong> available for client purchase.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500 font-medium">Filter by Status:</span>
          {['ALL', 'AVAILABLE', 'PARTIALLY_SOLD', 'RESERVED', 'SOLD', 'BLOCKED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === st ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">Showing {plots.length} plot units</span>
      </div>

      {/* Plot Grid Visualization */}
      {isPlotsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
        </div>
      ) : plots.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <Layers className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No plots found matching current criteria</p>
          <p className="text-xs text-slate-500 mt-1">Use the "Generate Plots" action to batch initialize inventory.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {plots.map((plot: any) => (
            <div
              key={plot.id}
              onClick={() => setSelectedPlot(plot)}
              className={`p-3 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${getPlotCardBg(
                plot.status,
              )}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-slate-900">{plot.plotNumber}</span>
                {getStatusBadge(plot.status)}
              </div>
              <div className="space-y-0.5 text-[11px] text-slate-600">
                <p className="font-medium text-slate-500">
                  {plot.plotType === 'HALF_PLOT' ? `Half Plot (${plot.halfPosition})` : 'Full Plot'}
                </p>
                <p className="font-bold text-slate-900">{formatGHS(plot.price)}</p>
                <p className="text-[10px] text-slate-400">{plot.dimensions}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plot Details Modal */}
      {selectedPlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedPlot.plotNumber} Details</h3>
                <p className="text-xs text-slate-500">{selectedPlot.landLocation?.name}</p>
              </div>
              {getStatusBadge(selectedPlot.status)}
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Plot Type:</span>
                <span className="font-semibold text-slate-800">
                  {selectedPlot.plotType === 'HALF_PLOT'
                    ? `Half Plot (${selectedPlot.halfPosition})`
                    : 'Standard Full Plot'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Official Dimensions:</span>
                <span className="font-semibold text-slate-800">{selectedPlot.dimensions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Standard Price:</span>
                <span className="font-bold text-slate-900 text-sm">{formatGHS(selectedPlot.price)}</span>
              </div>

              {selectedPlot.allocations && selectedPlot.allocations.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-800 mb-1">Active Client Allocation:</p>
                  <p className="text-slate-700">
                    Client: {selectedPlot.allocations[0].customer?.firstName}{' '}
                    {selectedPlot.allocations[0].customer?.lastName}
                  </p>
                  <p className="text-slate-500">
                    Outstanding Balance: {formatGHS(selectedPlot.allocations[0].outstandingBalance)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPlot(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Generate Plots Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Batch Generate Plot Inventory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generates Plot 1, Plot 1A, Plot 1B hierarchy adhering to Ghanaian naming standards.
            </p>

            {generateError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {generateError}
              </div>
            )}

            <form onSubmit={handleBatchGenerate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Land Location</label>
                <select
                  value={batchLocationId}
                  onChange={(e) => setBatchLocationId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  {locations.map((loc: any) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.region})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Full Plots Count</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={baseCount}
                    onChange={(e) => setBaseCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Generates {baseCount * 3} total units (1, 1A, 1B)</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Dimensions</label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Plot Price (GH₵)</label>
                  <input
                    type="number"
                    min="1"
                    value={fullPrice}
                    onChange={(e) => setFullPrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Half Plot Price (GH₵)</label>
                  <input
                    type="number"
                    min="1"
                    value={halfPrice}
                    onChange={(e) => setHalfPrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? 'Generating Plots...' : 'Generate Plots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

