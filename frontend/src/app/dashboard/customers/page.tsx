'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Printer,
  Calendar,
  Building,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  FileCheck,
  Sparkles,
  Edit,
  Share2,
  Send,
  MessageSquare,
  Tag,
  Percent,
  Download,
  Loader2,
  ChevronDown,
  Trash2,
  RotateCcw,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [printCustomer, setPrintCustomer] = useState<any>(null);
  const [sendCustomer, setSendCustomer] = useState<any>(null);

  // Registration Biodata State
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
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');

  // Photograph state (webcam / upload)
  const [photoSource, setPhotoSource] = useState<'NONE' | 'CAMERA_CAPTURE' | 'FILE_UPLOAD'>('NONE');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);

  // Land Location & Plot Selection State
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
  const [plotSearchQuery, setPlotSearchQuery] = useState('');
  const [isPlotDropdownOpen, setIsPlotDropdownOpen] = useState(false);

  // Headless PDF Export State
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Custom Pricing & Discount State
  const [isCustomPriceEnabled, setIsCustomPriceEnabled] = useState(false);
  const [customDiscountAmount, setCustomDiscountAmount] = useState<string>('');
  const [manualAgreedBasePrice, setManualAgreedBasePrice] = useState<string>('');

  // Payment Terms & Instalment Amortization State
  const [paymentTerms, setPaymentTerms] = useState<'OUTRIGHT' | 'INSTALMENT'>('OUTRIGHT');
  const [instalmentMonths, setInstalmentMonths] = useState<number>(3);
  const [initialDeposit, setInitialDeposit] = useState<string>('');

  // Editing State
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editOtherNames, setEditOtherNames] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editAltTelephone, setEditAltTelephone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editResidentialAddress, setEditResidentialAddress] = useState('');
  const [editGpsAddress, setEditGpsAddress] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editIdType, setEditIdType] = useState('GHANA_CARD');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Trash and Delete State
  const [showTrash, setShowTrash] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
  const [customerToPermanentlyDelete, setCustomerToPermanentlyDelete] = useState<any>(null);

  // Refund State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundCustomer, setRefundCustomer] = useState<any>(null);
  const [refundPlotId, setRefundPlotId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundDeductionAmount, setRefundDeductionAmount] = useState<string>('0');
  const [refundDeductionReason, setRefundDeductionReason] = useState('Administrative & Processing Fee');
  const [refundSuccessMsg, setRefundSuccessMsg] = useState<string | null>(null);

  // Financial / Instalment Editing State
  const [editPaymentTerms, setEditPaymentTerms] = useState<'OUTRIGHT' | 'INSTALMENT'>('OUTRIGHT');
  const [editInstalmentMonths, setEditInstalmentMonths] = useState<number>(3);
  const [editTotalAgreedPrice, setEditTotalAgreedPrice] = useState<number | string>(0);
  const [editTotalPaid, setEditTotalPaid] = useState<number>(0);
  const [editAllocations, setEditAllocations] = useState<any[]>([]);
  const [editCustomPriceEnabled, setEditCustomPriceEnabled] = useState(false);
  const [editCustomTotalAgreed, setEditCustomTotalAgreed] = useState<string>('');

  // 1. Fetch Customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () =>
      apiRequest('/customers', {
        params: { search: searchTerm || undefined, limit: 100 },
      }),
  });

  // 1B. Fetch Trashed Customers
  const { data: trashedCustomers = [], isLoading: isTrashLoading } = useQuery({
    queryKey: ['customers-trash'],
    queryFn: () => apiRequest('/customers/trash'),
  });

  const rawCustomers = customersData?.data || customersData?.customers || [];

  // Filter customers on client-side by Name, Customer ID, or Land Location
  const customers = useMemo(() => {
    if (!searchTerm.trim()) return rawCustomers;
    const term = searchTerm.toLowerCase().trim();
    return rawCustomers.filter((c: any) => {
      const matchName = `${c.firstName || ''} ${c.lastName || ''} ${c.otherNames || ''}`.toLowerCase().includes(term);
      const matchId = (c.customerNumber || '').toLowerCase().includes(term);
      const matchLoc = (c.primaryLocation || '').toLowerCase().includes(term) || (c.allLocations || '').toLowerCase().includes(term);
      const matchPhone = (c.telephone || '').includes(term);
      const matchPlot = c.plotNumbers?.some((p: string) => p.toLowerCase().includes(term));
      return matchName || matchId || matchLoc || matchPhone || matchPlot;
    });
  }, [rawCustomers, searchTerm]);

  // 2. Fetch Agents for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ['sales-agents'],
    queryFn: () => apiRequest('/users/agents'),
    enabled: isRegisterModalOpen && hasRole(['SUPER_ADMINISTRATOR', 'MANAGING_DIRECTOR', 'ADMINISTRATOR']),
  });

  // 3. Fetch Land Locations
  const { data: locations = [] } = useQuery({
    queryKey: ['land-locations'],
    queryFn: () => apiRequest('/land-locations'),
    enabled: isRegisterModalOpen,
  });

  const selectedLocation = locations.find((l: any) => l.id === selectedLocationId);

  // 4. Fetch Available Plots for Chosen Location
  const { data: availablePlots = [], isLoading: isPlotsLoading } = useQuery({
    queryKey: ['available-plots', selectedLocationId],
    queryFn: () => apiRequest(`/land-locations/${selectedLocationId}/available-plots`),
    enabled: !!selectedLocationId && isRegisterModalOpen,
  });

  // 4b. Fetch Inventory Breakdown for Chosen Location
  const { data: inventoryBreakdown } = useQuery({
    queryKey: ['inventory-breakdown', selectedLocationId],
    queryFn: () => apiRequest(`/land-locations/${selectedLocationId}/inventory-breakdown`),
    enabled: !!selectedLocationId && isRegisterModalOpen,
  });

  // Helper to format plot label: "Plot No. 1", "Plot No. 1A"
  const formatPlotLabel = (plotNum: string) => {
    if (!plotNum) return '';
    if (plotNum.toLowerCase().startsWith('plot no.')) return plotNum;
    const cleaned = plotNum.replace(/^Plot\s*/i, '');
    return `Plot No. ${cleaned}`;
  };

  // Filtered available plots by plot search term
  const filteredAvailablePlots = useMemo(() => {
    if (!plotSearchQuery.trim()) return availablePlots;
    const q = plotSearchQuery.toLowerCase().trim();
    return availablePlots.filter((p: any) =>
      p.plotNumber.toLowerCase().includes(q) || formatPlotLabel(p.plotNumber).toLowerCase().includes(q)
    );
  }, [availablePlots, plotSearchQuery]);

  // Selected plot objects
  const selectedPlotsList = useMemo(() => {
    return availablePlots.filter((p: any) => selectedPlotIds.includes(p.id));
  }, [availablePlots, selectedPlotIds]);

  // Breakdown of selected plot types
  const fullPlotsCount = useMemo(
    () => selectedPlotsList.filter((p: any) => p.plotType === 'FULL_PLOT').length,
    [selectedPlotsList],
  );
  const halfPlotsCount = useMemo(
    () => selectedPlotsList.filter((p: any) => p.plotType === 'HALF_PLOT').length,
    [selectedPlotsList],
  );

  // Exact plot count equivalent: 1 full plot = 1.0, 1 half plot = 0.5
  const totalPlotsCountEquivalent = useMemo(
    () => fullPlotsCount * 1.0 + halfPlotsCount * 0.5,
    [fullPlotsCount, halfPlotsCount],
  );

  // Itemized base price subtotals
  const fullPlotsSubtotal = useMemo(
    () => fullPlotsCount * (Number(selectedLocation?.standardFullPlotPrice) || 0),
    [fullPlotsCount, selectedLocation],
  );
  const halfPlotsSubtotal = useMemo(
    () => halfPlotsCount * (Number(selectedLocation?.standardHalfPlotPrice) || 0),
    [halfPlotsCount, selectedLocation],
  );

  // Standard Base Price from location pricing
  const standardBaseLandPrice = useMemo(() => {
    if (!selectedLocation || selectedPlotsList.length === 0) return 0;
    return fullPlotsSubtotal + halfPlotsSubtotal;
  }, [selectedLocation, selectedPlotsList, fullPlotsSubtotal, halfPlotsSubtotal]);

  // Effective Base Price after custom discount / manual pricing
  const effectiveBaseLandPrice = useMemo(() => {
    if (!isCustomPriceEnabled) return standardBaseLandPrice;
    if (manualAgreedBasePrice !== '') {
      const val = Number(manualAgreedBasePrice);
      return !isNaN(val) && val >= 0 ? val : standardBaseLandPrice;
    }
    if (customDiscountAmount !== '') {
      const discount = Number(customDiscountAmount) || 0;
      return Math.max(0, standardBaseLandPrice - discount);
    }
    return standardBaseLandPrice;
  }, [isCustomPriceEnabled, standardBaseLandPrice, manualAgreedBasePrice, customDiscountAmount]);

  // Interest calculation rule:
  // "Outright payments are interest-free. Instalments include an interest of GH₵1,000 per full plot
  // and GH₵500 per half plot for each 3-month cycle commencing after the initial 3-month grace period."
  // - 3 months: 0 cycles beyond first 3 months => GH₵ 0
  // - 6 months: 1 cycle (months 4-6) => 1 * (GH₵ 1000 * fullPlots + GH₵ 500 * halfPlots)
  // - 9 months: 2 cycles (months 4-6, 7-9) => 2 * (GH₵ 1000 * fullPlots + GH₵ 500 * halfPlots)
  // - 12 months: 3 cycles (months 4-6, 7-9, 10-12) => 3 * (GH₵ 1000 * fullPlots + GH₵ 500 * halfPlots)
  const interestCycles = useMemo(() => {
    if (paymentTerms !== 'INSTALMENT') return 0;
    return Math.max(0, Math.floor((instalmentMonths - 3) / 3));
  }, [paymentTerms, instalmentMonths]);

  // Itemized interest subtotals
  const fullPlotsInterestSubtotal = useMemo(
    () => fullPlotsCount * (interestCycles * 1000),
    [fullPlotsCount, interestCycles],
  );
  const halfPlotsInterestSubtotal = useMemo(
    () => halfPlotsCount * (interestCycles * 500),
    [halfPlotsCount, interestCycles],
  );

  const calculatedInterestAmount = useMemo(() => {
    if (paymentTerms !== 'INSTALMENT' || interestCycles === 0) return 0;
    return fullPlotsInterestSubtotal + halfPlotsInterestSubtotal;
  }, [paymentTerms, interestCycles, fullPlotsInterestSubtotal, halfPlotsInterestSubtotal]);

  const totalAgreedAmount = useMemo(() => {
    return effectiveBaseLandPrice + calculatedInterestAmount;
  }, [effectiveBaseLandPrice, calculatedInterestAmount]);

  const depositNum = useMemo(() => {
    const val = Number(initialDeposit);
    return isNaN(val) ? 0 : val;
  }, [initialDeposit]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalAgreedAmount - depositNum);
  }, [totalAgreedAmount, depositNum]);

  const monthlyInstalmentAmount = useMemo(() => {
    if (paymentTerms !== 'INSTALMENT' || instalmentMonths <= 0) return 0;
    return remainingBalance / instalmentMonths;
  }, [paymentTerms, instalmentMonths, remainingBalance]);

  // Calculation of financial updates when editing customer
  const editComputedBasePrice = useMemo(() => {
    if (!editAllocations || editAllocations.length === 0) return Number(editTotalAgreedPrice) || 0;
    return editAllocations.reduce((sum: number, a: any) => {
      const isHalf = a.plot?.plotType === 'HALF_PLOT' || a.allocationType === 'HALF_PLOT';
      const loc = a.plot?.landLocation;
      const base = isHalf
        ? (Number(loc?.standardHalfPlotPrice) || 28000)
        : (Number(loc?.standardFullPlotPrice) || 50000);
      return sum + base;
    }, 0);
  }, [editAllocations, editTotalAgreedPrice]);

  const editInterestCycles = useMemo(() => {
    if (editPaymentTerms !== 'INSTALMENT') return 0;
    return Math.max(0, Math.floor((editInstalmentMonths - 3) / 3));
  }, [editPaymentTerms, editInstalmentMonths]);

  const editComputedInterest = useMemo(() => {
    if (editPaymentTerms !== 'INSTALMENT' || editInterestCycles === 0) return 0;
    return editAllocations.reduce((sum: number, a: any) => {
      const isHalf = a.plot?.plotType === 'HALF_PLOT' || a.allocationType === 'HALF_PLOT';
      return sum + (isHalf ? editInterestCycles * 500 : editInterestCycles * 1000);
    }, 0);
  }, [editPaymentTerms, editInterestCycles, editAllocations]);

  const editCalculatedTotalPayable = useMemo(() => {
    if (editCustomPriceEnabled && editCustomTotalAgreed !== '') {
      const val = Number(editCustomTotalAgreed);
      return !isNaN(val) && val >= 0 ? val : editComputedBasePrice;
    }
    return editComputedBasePrice + editComputedInterest;
  }, [editCustomPriceEnabled, editCustomTotalAgreed, editComputedBasePrice, editComputedInterest]);

  const editOutstandingBalance = useMemo(() => {
    return Math.max(0, editCalculatedTotalPayable - editTotalPaid);
  }, [editCalculatedTotalPayable, editTotalPaid]);

  const editMonthlyInstalment = useMemo(() => {
    if (editPaymentTerms !== 'INSTALMENT' || editInstalmentMonths <= 0) return 0;
    return editOutstandingBalance / editInstalmentMonths;
  }, [editPaymentTerms, editInstalmentMonths, editOutstandingBalance]);

  // Handle plot multi-selection with hierarchy mutual exclusivity safeguards
  const handleTogglePlot = (plot: any) => {
    const isCurrentlySelected = selectedPlotIds.includes(plot.id);
    if (isCurrentlySelected) {
      setSelectedPlotIds((prev) => prev.filter((id) => id !== plot.id));
      return;
    }

    // Mutual exclusivity check:
    // If selecting a FULL PLOT, ensure neither of its child half plots (A or B) is already in selectedPlotIds!
    if (plot.plotType === 'FULL_PLOT') {
      const childHalves = availablePlots.filter((p: any) => p.parentPlotId === plot.id);
      const childHalvesSelected = childHalves.filter((h: any) => selectedPlotIds.includes(h.id));
      if (childHalvesSelected.length > 0) {
        const names = childHalvesSelected.map((h: any) => formatPlotLabel(h.plotNumber)).join(', ');
        setFormError(`Cannot select ${formatPlotLabel(plot.plotNumber)} because its half plot (${names}) is already selected.`);
        return;
      }
    }

    // If selecting a HALF PLOT, ensure its parent full plot is not selected!
    if (plot.plotType === 'HALF_PLOT' && plot.parentPlotId) {
      if (selectedPlotIds.includes(plot.parentPlotId)) {
        const parentPlot = availablePlots.find((p: any) => p.id === plot.parentPlotId);
        setFormError(`Cannot select ${formatPlotLabel(plot.plotNumber)} because parent ${formatPlotLabel(parentPlot?.plotNumber || '')} is already selected as a full plot.`);
        return;
      }
    }

    setFormError(null);
    setSelectedPlotIds((prev) => [...prev, plot.id]);
  };

  // Image upload with in-browser compression to max 1024px
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setPhotoBase64(canvas.toDataURL('image/jpeg', 0.88));
          } else {
            setPhotoBase64(event.target?.result as string);
          }
          setPhotoSource('FILE_UPLOAD');
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWebcamCapture = (base64Image: string) => {
    setPhotoBase64(base64Image);
    setPhotoSource('CAMERA_CAPTURE');
    setShowWebcam(false);
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
    setDateOfBirth('');
    setAssignedAgentId('');
    setPhotoBase64(null);
    setPhotoSource('NONE');
    setShowWebcam(false);
    setSelectedLocationId('');
    setSelectedPlotIds([]);
    setPaymentTerms('OUTRIGHT');
    setInstalmentMonths(3);
    setInitialDeposit('');
    setPlotSearchQuery('');
    setIsCustomPriceEnabled(false);
    setCustomDiscountAmount('');
    setManualAgreedBasePrice('');
    setFormError(null);
  };

  // Open Edit Customer Modal
  const handleOpenEditModal = (c: any) => {
    setEditingCustomerId(c.id);
    setEditFirstName(c.firstName || '');
    setEditLastName(c.lastName || '');
    setEditOtherNames(c.otherNames || '');
    setEditTelephone(c.telephone || '');
    setEditAltTelephone(c.altTelephone || '');
    setEditEmail(c.email || '');
    setEditResidentialAddress(c.residentialAddress || '');
    setEditGpsAddress(c.gpsAddress || '');
    setEditOccupation(c.occupation || '');
    setEditDateOfBirth(
      c.dateOfBirth
        ? typeof c.dateOfBirth === 'string'
          ? c.dateOfBirth.substring(0, 10)
          : new Date(c.dateOfBirth).toISOString().substring(0, 10)
        : '',
    );
    setEditIdType(c.idType || 'GHANA_CARD');
    setEditIdNumber(c.idNumber || '');
    setEditStatus(c.status || 'ACTIVE');

    // Populate financial terms & instalment options
    const isInst =
      (c.paymentTerm || '').toLowerCase().includes('instalment') ||
      (c.allocations && c.allocations.some((a: any) => a.paymentPlanMonths > 1));
    setEditPaymentTerms(isInst ? 'INSTALMENT' : 'OUTRIGHT');
    const months = c.allocations?.[0]?.paymentPlanMonths || 3;
    setEditInstalmentMonths(months > 1 ? months : 3);

    const totalAgreed =
      c.financials?.totalAgreedPrice ||
      c.allocations?.reduce((sum: number, a: any) => sum + Number(a.agreedPrice || 0), 0) ||
      0;
    const totalPaid =
      c.financials?.totalAmountPaid ||
      c.allocations?.reduce((sum: number, a: any) => sum + Number(a.totalAmountPaid || 0), 0) ||
      0;
    setEditTotalAgreedPrice(totalAgreed);
    setEditTotalPaid(totalPaid);
    setEditAllocations(c.allocations || []);
    setEditCustomPriceEnabled(false);
    setEditCustomTotalAgreed('');

    setFormError(null);
    setEditSuccessMsg(null);
    setIsEditModalOpen(true);
  };

  // Submit Edit Customer
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await apiRequest(`/customers/${editingCustomerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          otherNames: editOtherNames.trim() || undefined,
          telephone: editTelephone.trim(),
          altTelephone: editAltTelephone.trim() || undefined,
          email: editEmail.trim() || undefined,
          residentialAddress: editResidentialAddress.trim(),
          gpsAddress: editGpsAddress.trim() || undefined,
          occupation: editOccupation.trim() || undefined,
          dateOfBirth: editDateOfBirth || undefined,
          idType: editIdType,
          idNumber: editIdNumber.trim() || undefined,
          status: editStatus,
          paymentTerms: editPaymentTerms,
          instalmentMonths: editPaymentTerms === 'INSTALMENT' ? editInstalmentMonths : 1,
          totalAgreedPrice: editCalculatedTotalPayable,
        }),
      });

      setEditSuccessMsg('Customer details and payment schedule updated successfully!');
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['customers-trash'] });
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccessMsg(null);
      }, 900);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update customer details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete & Trash Handlers
  const handleOpenDeleteModal = (c: any) => {
    setCustomerToDelete(c);
    setFormError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiRequest(`/customers/${customerToDelete.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['customers-trash'] });
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      await queryClient.invalidateQueries({ queryKey: ['plots'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to move customer to trash');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreCustomer = async (c: any) => {
    setIsSubmitting(true);
    try {
      await apiRequest(`/customers/${c.id}/restore`, { method: 'PATCH' });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['customers-trash'] });
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      await queryClient.invalidateQueries({ queryKey: ['plots'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to restore customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPermanentDeleteModal = (c: any) => {
    setCustomerToPermanentlyDelete(c);
    setFormError(null);
    setIsPermanentDeleteModalOpen(true);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!customerToPermanentlyDelete) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiRequest(`/customers/${customerToPermanentlyDelete.id}/permanent`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['customers-trash'] });
      await queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      await queryClient.invalidateQueries({ queryKey: ['plots'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setIsPermanentDeleteModalOpen(false);
      setCustomerToPermanentlyDelete(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to permanently delete customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refund Handlers
  const handleOpenRefundModal = (c: any) => {
    setRefundCustomer(c);
    const firstAlloc = c.allocations?.[0];
    const firstPlotId = firstAlloc?.plotId || firstAlloc?.plot?.id || firstAlloc?.id || '';
    setRefundPlotId(firstPlotId);
    setRefundReason('');
    setRefundDeductionAmount('0');
    setRefundDeductionReason('Administrative & Processing Fee');
    setRefundSuccessMsg(null);
    setFormError(null);
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundCustomer) return;

    const activeAlloc = refundCustomer?.allocations?.find(
      (a: any) =>
        (a.plotId && a.plotId === refundPlotId) ||
        (a.plot?.id && a.plot?.id === refundPlotId) ||
        (a.id && a.id === refundPlotId),
    ) || refundCustomer?.allocations?.[0];

    const targetPlotId = activeAlloc?.plotId || activeAlloc?.plot?.id || activeAlloc?.id || refundPlotId;

    if (!targetPlotId) {
      setFormError('No allocated plot found for refund');
      return;
    }
    if (!refundReason.trim() || refundReason.trim().length < 10) {
      setFormError('Please enter a clear reason for the refund (minimum 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const deductionVal = Number(refundDeductionAmount) || 0;
    const deductions =
      deductionVal > 0
        ? [
            {
              deductionName: refundDeductionReason.trim() || 'Administrative Fee',
              amount: deductionVal,
              explanation: 'Statutory/administrative processing deduction',
            },
          ]
        : [];

    try {
      await apiRequest('/refunds', {
        method: 'POST',
        body: JSON.stringify({
          customerId: refundCustomer.id,
          plotId: targetPlotId,
          reason: refundReason.trim(),
          deductions,
        }),
      });

      setRefundSuccessMsg('Customer successfully activated for refund and transferred to Refund Workflow!');
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      setTimeout(() => {
        setIsRefundModalOpen(false);
        setRefundSuccessMsg(null);
        setRefundCustomer(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to activate customer refund');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Register Customer
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        otherNames: otherNames.trim() || undefined,
        telephone: telephone.trim(),
        altTelephone: altTelephone.trim() || undefined,
        email: email.trim() || undefined,
        residentialAddress: residentialAddress.trim(),
        gpsAddress: gpsAddress.trim() || undefined,
        occupation: occupation.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        idType,
        idNumber: idNumber.trim() || undefined,
        assignedAgentId: assignedAgentId || undefined,
        photoSource: photoSource !== 'NONE' ? photoSource : undefined,
        photoBase64: photoBase64 || undefined,
        cameraPhotoBase64: photoBase64 || undefined,
      };

      if (selectedPlotIds.length > 0) {
        payload.landLocationId = selectedLocationId;
        payload.plotIds = selectedPlotIds;
        payload.paymentTerms = paymentTerms;
        payload.instalmentMonths = paymentTerms === 'INSTALMENT' ? instalmentMonths : 1;
        payload.unitPrice = selectedLocation ? Number(selectedLocation.standardFullPlotPrice) : undefined;
        payload.interestAmount = calculatedInterestAmount;
        payload.totalAmount = totalAgreedAmount;
        payload.initialDeposit = depositNum > 0 ? depositNum : undefined;
      }

      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsRegisterModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['land-locations'] });
      queryClient.invalidateQueries({ queryKey: ['available-plots'] });
      queryClient.invalidateQueries({ queryKey: ['location-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });

      // Automatically open the print preview for the newly enrolled customer!
      if (res?.customer) {
        setPrintCustomer(res.customer);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Form via WhatsApp
  const handleSendWhatsApp = (c: any) => {
    const phone = (c.telephone || '').replace(/[\s\-\(\)\+]/g, '');
    const intlPhone = phone.startsWith('0') ? `233${phone.slice(1)}` : phone.startsWith('233') ? phone : `233${phone}`;
    const locationName = c.primaryLocation || c.allLocations || 'Registered Site';
    const plotsText = c.plotNumbers && c.plotNumbers.length > 0
      ? c.plotNumbers.map((p: string) => formatPlotLabel(p)).join(', ')
      : 'General Allocation';

    const agreedPrice = formatGHS(c.financials?.totalAgreedPrice || c.ledger?.totalAgreedPrice || 0);
    const paidAmount = formatGHS(c.financials?.totalAmountPaid || c.ledger?.totalAmountPaid || 0);
    const balance = formatGHS(c.financials?.outstandingBalance || c.ledger?.totalOutstandingBalance || 0);
    const paymentTerm = c.paymentTerm || 'Outright';

    const message = `*REAL ESTATE DEVELOPMENT GHANA LTD*
_Official Customer Registration & Land Acquisition Deed_

Dear *${c.firstName} ${c.lastName}*,

Your land registration and parcel allocation has been recorded successfully. Here is your official transaction summary:

📄 *Customer ID:* ${c.customerNumber}
📍 *Land Location:* ${locationName}
🗺️ *Allocated Plot(s):* ${plotsText}
💳 *Payment Term:* ${paymentTerm}
💰 *Total Consideration:* ${agreedPrice}
💵 *Amount Paid / Deposit:* ${paidAmount}
⏳ *Outstanding Balance:* ${balance}

Your official deed application form is on file. Please visit our client portal or contact your relationship officer for documents and title processing.

Thank you for choosing Real Estate Development Ghana Ltd!
📞 Tel: +233 (0) 244 000 001 | 📍 14 Kofi Annan Street, Airport Residential Area, Accra`;

    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Send Form via Email
  const handleSendEmail = (c: any) => {
    if (!c.email) {
      alert(`Customer ${c.firstName} ${c.lastName} does not have an email address recorded. Please use WhatsApp or edit their profile to add an email.`);
      return;
    }

    const locationName = c.primaryLocation || c.allLocations || 'Registered Site';
    const plotsText = c.plotNumbers && c.plotNumbers.length > 0
      ? c.plotNumbers.map((p: string) => formatPlotLabel(p)).join(', ')
      : 'General Allocation';

    const agreedPrice = formatGHS(c.financials?.totalAgreedPrice || c.ledger?.totalAgreedPrice || 0);
    const paidAmount = formatGHS(c.financials?.totalAmountPaid || c.ledger?.totalAmountPaid || 0);
    const balance = formatGHS(c.financials?.outstandingBalance || c.ledger?.totalOutstandingBalance || 0);
    const paymentTerm = c.paymentTerm || 'Outright';

    const subject = encodeURIComponent(`Official Land Registration & Plot Allocation Deed - ${c.customerNumber}`);
    const body = encodeURIComponent(`Dear ${c.firstName} ${c.lastName},

Thank you for choosing REAL ESTATE DEVELOPMENT GHANA LTD.

Here are the confirmed details of your official land registration and plot acquisition:

- Customer ID: ${c.customerNumber}
- Land Location: ${locationName}
- Allocated Plot(s): ${plotsText}
- Payment Term: ${paymentTerm}
- Total Agreed Price: ${agreedPrice}
- Amount Paid / Deposit: ${paidAmount}
- Outstanding Balance: ${balance}

Your customer form and indenture documentation are being processed in accordance with the Lands Commission Act 2020 (Act 1036).

Kind regards,
Client Services & Conveyancing Department
Real Estate Development Ghana Ltd
14 Kofi Annan Street, Airport Residential Area, Accra
Tel: +233 (0) 244 000 001`);

    window.open(`mailto:${c.email}?subject=${subject}&body=${body}`, '_blank');
  };

  // Dedicated Automated Ultra-Sharp Headless PDF Download using jsPDF + html2canvas (Lossless PNG @ 336 DPI)
  const handleDownloadPdf = async (c: any) => {
    if (!c) return;
    setIsExportingPdf(true);
    try {
      const el = document.getElementById('official-customer-certificate-document');
      if (!el) {
        throw new Error('Certificate document element not found.');
      }

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      // High-resolution rendering: scale 3.5 gives ~336 DPI for crisp text & borders
      const canvas = await html2canvas(el, {
        scale: 3.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('official-customer-certificate-document');
          if (target) {
            target.style.width = '794px';
            target.style.maxWidth = '794px';
            target.style.height = 'auto';
            target.style.minHeight = 'auto';
            target.style.maxHeight = 'none';
            target.style.overflow = 'visible';
            target.style.boxShadow = 'none';
            target.style.margin = '0 auto';
            (target.style as any).webkitFontSmoothing = 'antialiased';
            (target.style as any).textRendering = 'geometricPrecision';

            // Ensure all inner cards, signature pods, and text rows have visible overflow and natural line height
            target.querySelectorAll('.rounded-xl, .border, .grid').forEach((node: any) => {
              node.style.overflow = 'visible';
            });

            let parent = target.parentElement;
            while (parent) {
              parent.style.height = 'auto';
              parent.style.maxHeight = 'none';
              parent.style.overflow = 'visible';
              parent = parent.parentElement;
            }
          }
        },
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2; // 194mm
      const pageUsableHeight = pdfHeight - margin * 2; // 281mm
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      if (contentHeight <= pageUsableHeight) {
        // Fits cleanly on 1 single portrait A4 page
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
      } else {
        // Multi-page clean canvas slicing: ensures zero bleed and perfect margins on every page
        const pxPerPage = Math.floor((canvas.width * pageUsableHeight) / contentWidth);
        const totalPages = Math.ceil(canvas.height / pxPerPage);

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          const sY = i * pxPerPage;
          const sH = Math.min(pxPerPage, canvas.height - sY);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sH;
          const pCtx = pageCanvas.getContext('2d');
          if (pCtx) {
            pCtx.fillStyle = '#ffffff';
            pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pCtx.drawImage(canvas, 0, sY, canvas.width, sH, 0, 0, pageCanvas.width, sH);
            const pageImgData = pageCanvas.toDataURL('image/png');
            const pageRenderHeight = (sH * contentWidth) / canvas.width;
            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageRenderHeight, undefined, 'FAST');
          }
        }
      }

      const clientName = `${c.firstName || 'Client'}_${c.lastName || ''}`.trim().replace(/\s+/g, '_');
      const filename = `Customer_${c.customerNumber || 'Form'}_${clientName}_Acquisition_Deed.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      console.error('Headless PDF export error:', err);
      alert('Could not export PDF directly. Please use the Print button to Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer CRM & Acquisition</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enroll clients with Ghanaian KYC, allocate full/half plots, calculate amortized payment plans, and print official application forms.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowTrash(!showTrash)}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              showTrash
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title="View customer trash and deleted records"
          >
            <Trash2 className="h-4 w-4" />
            <span>Trash</span>
            {trashedCustomers.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  showTrash ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'
                }`}
              >
                {trashedCustomers.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsRegisterModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Register New Customer</span>
          </button>
        </div>
      </div>

      {/* Search Bar - Supports Name, Land Location, or Customer ID */}
      <div className="flex items-center space-x-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer name, land location (e.g. East Legon), or customer ID (CUST-202611-0001)..."
          className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2 py-1 rounded bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Customer Preview List OR Trash Archive View */}
      {showTrash ? (
        <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
          {/* Trash Header Banner */}
          <div className="bg-red-50/70 border-b border-red-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-red-100 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-950 flex items-center space-x-2">
                  <span>Customer Trash & Archive (Deleted Records)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-200 text-red-900">
                    {trashedCustomers.length} {trashedCustomers.length === 1 ? 'Record' : 'Records'}
                  </span>
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Customers in trash can be restored back to active CRM or permanently erased.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTrash(false)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer self-start sm:self-center"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Active Customers</span>
            </button>
          </div>

          {isTrashLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-red-500 border-t-transparent" />
            </div>
          ) : trashedCustomers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Trash2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Trash is currently empty</p>
              <p className="text-xs text-slate-400 mt-1">
                When you delete a customer from the CRM table, they will appear here.
              </p>
              <button
                type="button"
                onClick={() => setShowTrash(false)}
                className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Active CRM</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Land Location & Plot(s)</th>
                    <th className="py-3 px-4">Date Deleted</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trashedCustomers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                            {c.firstName?.[0] || 'C'}
                            {c.lastName?.[0] || ''}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {c.firstName} {c.lastName} {c.otherNames || ''}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.customerNumber}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <p className="font-medium text-slate-800">{c.telephone}</p>
                        {c.email && <p className="text-[11px] text-slate-400">{c.email}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">{c.primaryLocation}</span>
                        {c.plotNumbers && c.plotNumbers.length > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {c.plotNumbers.map((p: string) => formatPlotLabel(p)).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {c.deletedAt
                          ? new Date(c.deletedAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recently'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRestoreCustomer(c)}
                            disabled={isSubmitting}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition cursor-pointer"
                            title="Restore customer to active CRM"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPermanentDeleteModal(c)}
                            disabled={isSubmitting}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs transition cursor-pointer"
                            title="Permanently erase record from database"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Permanently</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No customer records found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm ? 'Try a different search query.' : 'Click "Register New Customer" to register your first client.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Client / Photo</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Land Location & Plot(s)</th>
                    <th className="py-3 px-4">Payment Term</th>
                    <th className="py-3 px-4 text-right">Agreed Value</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c: any) => {
                    const primaryPhoto = c.photographs?.[0]?.fileUrl || c.primaryPhotoUrl;
                    const locationDisplay = c.primaryLocation || c.allLocations || 'Pending Location';
                    const plotsDisplay = c.plotNumbers && c.plotNumbers.length > 0
                      ? c.plotNumbers.map((p: string) => formatPlotLabel(p)).join(', ')
                      : null;
                    const isInstalment = (c.paymentTerm || '').toLowerCase().includes('instalment');

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Client / Photo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {primaryPhoto ? (
                              <img
                                src={primaryPhoto}
                                alt={c.firstName}
                                className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-sm"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                                {c.firstName?.[0] || 'C'}
                                {c.lastName?.[0] || ''}
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

                        {/* Contact */}
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

                        {/* Land Location & Plots */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900 block flex items-center space-x-1">
                              <Building className="h-3 w-3 text-amber-500" />
                              <span>{locationDisplay}</span>
                            </span>
                            {plotsDisplay && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {plotsDisplay}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Payment Term */}
                        <td className="py-3 px-4">
                          {isInstalment ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {c.paymentTerm}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Outright
                            </span>
                          )}
                        </td>

                        {/* Agreed Value */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatGHS(c.financials?.totalAgreedPrice || c.ledger?.totalAgreedPrice || 0)}
                        </td>

                        {/* Outstanding Balance */}
                        <td className="py-3 px-4 text-right font-bold text-amber-600">
                          {formatGHS(c.financials?.outstandingBalance || c.ledger?.totalOutstandingBalance || 0)}
                        </td>

                        {/* Actions: Eye (Profile & Edit), Printer (Print & Send), Refund, Delete */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            {/* 1. View Customer Profile (embeds Edit Details) */}
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(c)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                              title="View Customer Profile (with Edit Details)"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* 2. Print / Save PDF Form (embeds Send via WhatsApp & Email) */}
                            <button
                              type="button"
                              onClick={() => setPrintCustomer(c)}
                              className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition cursor-pointer"
                              title="Print / Save PDF Form"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>

                            {/* 3. Refund Icon: Activates customer for refund */}
                            <button
                              type="button"
                              onClick={() => handleOpenRefundModal(c)}
                              className="p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 transition cursor-pointer"
                              title="Activate Customer for Refund (Transfer to Refund Workflow)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>

                            {/* 4. Delete Icon: Move to Trash */}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(c)}
                              className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition cursor-pointer"
                              title="Move Customer to Trash"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CUSTOMER REGISTRATION MODAL (WITH MULTI-PLOT, DISCOUNT & SPREAD INTEREST) */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            {/* Modal Header with High-Visibility Close Button */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-amber-400" />
                  <span>Customer Registration & Plot Acquisition</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Capture biodata, allocate multiple full/half plots, customize pricing discounts, and calculate payment plans.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close registration modal"
                aria-label="Close"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
              {/* SECTION A: BIOMETRICS & PHOTOGRAPH */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Camera className="h-4 w-4 text-amber-600" />
                    <span>Customer Photograph (Webcam or File Upload)</span>
                  </span>
                  {photoBase64 && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Photo Captured</span>
                    </span>
                  )}
                </div>

                {showWebcam ? (
                  <WebcamCapture
                    onCapture={handleWebcamCapture}
                    onCancel={() => setShowWebcam(false)}
                  />
                ) : (
                  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    {photoBase64 ? (
                      <div className="relative">
                        <img
                          src={photoBase64}
                          alt="Customer preview"
                          className="h-24 w-24 rounded-xl object-cover border-2 border-emerald-500 shadow"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoBase64(null);
                            setPhotoSource('NONE');
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-24 w-24 rounded-xl bg-slate-200 flex flex-col items-center justify-center text-slate-400 border border-slate-300">
                        <Camera className="h-8 w-8" />
                        <span className="text-[9px] mt-1 text-slate-500">No Photo</span>
                      </div>
                    )}

                    <div className="space-y-2 text-left">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowWebcam(true)}
                          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>Capture from Device Camera</span>
                        </button>

                        <label className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer shadow-sm">
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
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION B: PERSONAL PARTICULARS */}
              <div className="space-y-3">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1">
                  1. Client Biodata & Contact Details
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Kwame"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
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
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Other Names</label>
                    <input
                      type="text"
                      value={otherNames}
                      onChange={(e) => setOtherNames(e.target.value)}
                      placeholder="Kofi"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ghana Telephone *</label>
                    <input
                      type="tel"
                      required
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="0244123456"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alternate Phone</label>
                    <input
                      type="tel"
                      value={altTelephone}
                      onChange={(e) => setAltTelephone(e.target.value)}
                      placeholder="0201234567"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="kwame.mensah@gmail.com"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Occupation</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="Civil Engineer / Contractor"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">National ID Type</label>
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="GHANA_CARD">Ghana Card (GHA-...)</option>
                      <option value="PASSPORT">Ghana Passport</option>
                      <option value="VOTER_ID">Voter ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID / Ghana Card Number</label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="GHA-712345678-9"
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Residential Address *</label>
                    <input
                      type="text"
                      required
                      value={residentialAddress}
                      onChange={(e) => setResidentialAddress(e.target.value)}
                      placeholder="House No 14, East Legon, Accra"
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ghana Post GPS Address</label>
                    <input
                      type="text"
                      value={gpsAddress}
                      onChange={(e) => setGpsAddress(e.target.value)}
                      placeholder="GA-183-9020"
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION C: LAND LOCATION & DYNAMIC MULTI-PLOT SELECTION (INVENTORY SYNC) */}
              <div className="space-y-3">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1">
                  2. Land Location & Multiple Plot Selection
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Land Location</label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => {
                        setSelectedLocationId(e.target.value);
                        setSelectedPlotIds([]);
                        setPlotSearchQuery('');
                        setIsPlotDropdownOpen(false);
                        setCustomDiscountAmount('');
                        setManualAgreedBasePrice('');
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none font-semibold text-slate-800"
                    >
                      <option value="">-- Choose Location --</option>
                      {locations.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.region} - {loc.district})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedLocation && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                          {selectedLocation.name} Standard Pricing
                        </span>
                        <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-semibold">
                          {selectedLocation.totalLandSizeAcres} Acres
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-700">
                        <span>
                          <span className="text-slate-500">Full Plot:</span> <strong className="text-slate-900">{formatGHS(selectedLocation.standardFullPlotPrice)}</strong>
                        </span>
                        <span>
                          <span className="text-slate-500">Half Plot:</span> <strong className="text-slate-900">{formatGHS(selectedLocation.standardHalfPlotPrice)}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Real-Time Land & Plot Inventory Status Sync */}
                {selectedLocationId && (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center divide-x divide-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Plots in Site</span>
                      <strong className="text-sm font-bold text-slate-900">
                        {inventoryBreakdown?.inventory?.totalPlots ??
                          inventoryBreakdown?.totalPlots ??
                          selectedLocation?.totalPlotsCount ??
                          selectedLocation?.totalPlots ??
                          availablePlots.length}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Plots Sold / Blocked</span>
                      <strong className="text-sm font-bold text-slate-600">
                        {inventoryBreakdown?.inventory?.plotsSold ??
                          inventoryBreakdown?.plotsSold ??
                          ((inventoryBreakdown?.soldPlots || 0) +
                            (inventoryBreakdown?.partiallySoldPlots || 0) +
                            (inventoryBreakdown?.reservedPlots || 0))}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Plots Available Left</span>
                      <strong className="text-sm font-bold text-emerald-700">
                        {inventoryBreakdown?.inventory?.plotsLeft ??
                          inventoryBreakdown?.inventory?.availablePlots ??
                          inventoryBreakdown?.availablePlots ??
                          availablePlots.length}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Dynamic Plot Search-and-Select Input & Predictive Dropdown */}
                {selectedLocationId && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 relative">
                    {/* Live Instant Count Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 text-xs">Dynamic Plot Selector:</span>
                        <span className="bg-slate-100 text-slate-800 border border-slate-300 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                          {selectedPlotIds.length} Selected ({fullPlotsCount} Full, {halfPlotsCount} Half)
                        </span>
                      </div>
                      {selectedPlotIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPlotIds([])}
                          className="text-[11px] text-slate-500 hover:text-slate-900 font-semibold cursor-pointer underline"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    {/* Search Input Box */}
                    <div className="relative">
                      <div className="relative flex items-center">
                        <Search className="absolute left-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={plotSearchQuery}
                          onChange={(e) => {
                            setPlotSearchQuery(e.target.value);
                            setIsPlotDropdownOpen(true);
                          }}
                          onFocus={() => setIsPlotDropdownOpen(true)}
                          placeholder="Type plot number to search (e.g. Plot 1, 1A, 2, 5B)..."
                          className="w-full pl-9 pr-24 py-2.5 text-xs rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                        />
                        <div className="absolute right-2 flex items-center space-x-1">
                          {plotSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setPlotSearchQuery('')}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="Clear search"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsPlotDropdownOpen((prev) => !prev)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                            title="Toggle plot dropdown"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Predictive Dropdown List */}
                      {isPlotDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                          <div className="p-2 bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-between sticky top-0 z-10">
                            <span>
                              Available Plots Matching ({filteredAvailablePlots.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsPlotDropdownOpen(false)}
                              className="text-slate-500 hover:text-slate-900 px-1.5 py-0.5 rounded text-[10px] bg-slate-200"
                            >
                              Done / Close
                            </button>
                          </div>

                          {isPlotsLoading ? (
                            <div className="p-4 text-center text-slate-500 text-xs">
                              Loading inventory plots...
                            </div>
                          ) : filteredAvailablePlots.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-xs">
                              No available plots found matching &quot;{plotSearchQuery}&quot;.
                            </div>
                          ) : (
                            filteredAvailablePlots.map((plot: any) => {
                              const isSelected = selectedPlotIds.includes(plot.id);
                              const isHalf = plot.plotType === 'HALF_PLOT';
                              const label = formatPlotLabel(plot.plotNumber);

                              // Mutual exclusivity check
                              let isBlockedByConflict = false;
                              let conflictReason = '';
                              if (!isSelected) {
                                if (plot.plotType === 'FULL_PLOT') {
                                  const childHalves = availablePlots.filter(
                                    (p: any) => p.parentPlotId === plot.id,
                                  );
                                  const childSelected = childHalves.filter((h: any) =>
                                    selectedPlotIds.includes(h.id),
                                  );
                                  if (childSelected.length > 0) {
                                    isBlockedByConflict = true;
                                    conflictReason = `Half plot (${childSelected
                                      .map((h: any) => formatPlotLabel(h.plotNumber))
                                      .join(', ')}) already selected`;
                                  }
                                } else if (plot.plotType === 'HALF_PLOT' && plot.parentPlotId) {
                                  if (selectedPlotIds.includes(plot.parentPlotId)) {
                                    isBlockedByConflict = true;
                                    conflictReason = 'Parent full plot already selected';
                                  }
                                }
                              }

                              return (
                                <button
                                  key={plot.id}
                                  type="button"
                                  disabled={isBlockedByConflict}
                                  onClick={() => handleTogglePlot(plot)}
                                  className={`w-full p-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-100 hover:bg-amber-200 text-slate-950 font-bold'
                                      : isBlockedByConflict
                                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-xs">{label}</span>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                          isHalf
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {isHalf
                                          ? `Half Plot (${plot.halfPosition === 'PART_A' ? 'Part A' : 'Part B'} - 50x70ft)`
                                          : 'Full Plot (70x100ft)'}
                                      </span>
                                    </div>
                                    {isBlockedByConflict ? (
                                      <span className="text-[10px] text-red-500 italic block mt-0.5">
                                        {conflictReason}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 block mt-0.5">
                                        Standard Price:{' '}
                                        {formatGHS(
                                          isHalf
                                            ? selectedLocation?.standardHalfPlotPrice
                                            : selectedLocation?.standardFullPlotPrice,
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    {isSelected ? (
                                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-900 bg-amber-300 px-2 py-0.5 rounded">
                                        <Check className="h-3 w-3" />
                                        <span>Selected</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                                        + Add Plot
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Plot Chips */}
                    {selectedPlotsList.length > 0 ? (
                      <div className="pt-2">
                        <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Currently Selected Plot(s):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlotsList.map((plot: any) => (
                            <span
                              key={plot.id}
                              className="inline-flex items-center space-x-1.5 bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm"
                            >
                              <span>
                                {formatPlotLabel(plot.plotNumber)} (
                                {plot.plotType === 'HALF_PLOT' ? 'Half Plot' : 'Full Plot'})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleTogglePlot(plot)}
                                className="text-slate-300 hover:text-white font-bold ml-0.5 cursor-pointer"
                                title="Remove plot"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic pt-1">
                        Use the search box above to find and select one or more plots from the available inventory.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION D: CUSTOMISE AMOUNT / DISCOUNT & PAYMENT TERMS */}
              {selectedPlotIds.length > 0 && (
                <div className="space-y-4">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>3. Pricing Customisation, Terms of Payment & Financial Schedule</span>
                    <span className="text-slate-600 font-semibold text-xs">Standard Real Estate Terms</span>
                  </span>

                  {/* Pricing Customisation Toggle */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-4 w-4 text-slate-700" />
                        <span className="font-bold text-slate-800 text-xs">
                          Customise Amount / Apply Client Discount
                        </span>
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCustomPriceEnabled}
                          onChange={(e) => setIsCustomPriceEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                        />
                        <span className="text-xs font-semibold text-slate-700">Enable Custom Price / Discount</span>
                      </label>
                    </div>

                    {isCustomPriceEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Discount / Reduction (GH₵)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={customDiscountAmount}
                            onChange={(e) => {
                              setCustomDiscountAmount(e.target.value);
                              setManualAgreedBasePrice('');
                            }}
                            placeholder="e.g. 5000"
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5">Deducted from standard base price</p>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Or Set Custom Agreed Base Price (GH₵)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={manualAgreedBasePrice}
                            onChange={(e) => {
                              setManualAgreedBasePrice(e.target.value);
                              setCustomDiscountAmount('');
                            }}
                            placeholder="e.g. 120000"
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5">Directly overrides the standard base price</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Terms Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentTerms('OUTRIGHT')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        paymentTerms === 'OUTRIGHT'
                          ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium'
                      }`}
                    >
                      <span className="block text-sm font-bold">Outright Payment</span>
                      <span className="text-[11px] opacity-80">Full single settlement (Interest-Free)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentTerms('INSTALMENT')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        paymentTerms === 'INSTALMENT'
                          ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium'
                      }`}
                    >
                      <span className="block text-sm font-bold">Instalment Payment Plan</span>
                      <span className="text-[11px] opacity-80">3, 6, 9, or 12 Months Deferred</span>
                    </button>
                  </div>

                  {/* Instalment Duration Options */}
                  {paymentTerms === 'INSTALMENT' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-800 text-xs">
                          Select Instalment Period:
                        </label>
                        <span className="text-[11px] text-slate-600 font-medium">
                          Note: GH₵1,000 / Full Plot & GH₵500 / Half Plot every 3 months (except 1st 3 months).
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[3, 6, 9, 12].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setInstalmentMonths(m)}
                            className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${
                              instalmentMonths === m
                                ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-sm'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold'
                            }`}
                          >
                            <span className="block text-xs">{m} Months</span>
                            <span className="text-[10px] opacity-75">
                              {m === 3
                                ? 'Interest-Free'
                                : `${formatGHS(
                                    Math.floor((m - 3) / 3) *
                                      (fullPlotsCount * 1000 + halfPlotsCount * 500),
                                  )} Interest`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Itemized Calculation & Math Verification Box */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 pb-1.5 font-bold text-slate-900">
                      <span className="flex items-center space-x-1.5">
                        <Layers className="h-4 w-4 text-slate-600" />
                        <span>Itemized Calculation & Pricing Breakdown</span>
                      </span>
                      <span className="bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                        {totalPlotsCountEquivalent} Total Plots ({fullPlotsCount} Full, {halfPlotsCount} Half)
                      </span>
                    </div>

                    {/* Unit Prices & Plot Math */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {fullPlotsCount > 0 && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                          <span className="text-slate-700">
                            <strong>{fullPlotsCount} Full Plot(s)</strong> @ {formatGHS(selectedLocation?.standardFullPlotPrice)}
                          </span>
                          <strong className="text-slate-950">{formatGHS(fullPlotsSubtotal)}</strong>
                        </div>
                      )}
                      {halfPlotsCount > 0 && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                          <span className="text-slate-700">
                            <strong>{halfPlotsCount} Half Plot(s)</strong> @ {formatGHS(selectedLocation?.standardHalfPlotPrice)}
                          </span>
                          <strong className="text-slate-950">{formatGHS(halfPlotsSubtotal)}</strong>
                        </div>
                      )}
                    </div>

                    {/* Custom Discount / Price Adjustment */}
                    {isCustomPriceEnabled && (customDiscountAmount || manualAgreedBasePrice) && (
                      <div className="p-2 bg-white rounded-lg border border-slate-300 text-[11px] flex items-center justify-between">
                        <span className="text-slate-700 font-medium">
                          {customDiscountAmount
                            ? `Custom Client Discount: -${formatGHS(Number(customDiscountAmount) || 0)}`
                            : `Manual Base Price Override: ${formatGHS(effectiveBaseLandPrice)}`}
                        </span>
                        <span className="text-slate-900 font-bold">
                          Effective Base: {formatGHS(effectiveBaseLandPrice)}
                        </span>
                      </div>
                    )}

                    {/* Instalment Interest Detailed Math */}
                    {paymentTerms === 'INSTALMENT' && (
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-900 font-bold">
                          <span>
                            {instalmentMonths} Months Plan (
                            {interestCycles === 0
                              ? 'Initial 3 months interest-free'
                              : `${interestCycles} × 3-month cycle(s) beyond first 3 months`}
                            )
                          </span>
                          <span className="text-slate-900 font-extrabold">
                            +{formatGHS(calculatedInterestAmount)} Interest
                          </span>
                        </div>
                        {interestCycles > 0 && (
                          <div className="flex flex-wrap gap-x-4 text-[10.5px] text-slate-600">
                            {fullPlotsCount > 0 && (
                              <span>
                                Full: {fullPlotsCount} × ({interestCycles} × GH₵ 1,000) = {formatGHS(fullPlotsInterestSubtotal)}
                              </span>
                            )}
                            {halfPlotsCount > 0 && (
                              <span>
                                Half: {halfPlotsCount} × ({interestCycles} × GH₵ 500) = {formatGHS(halfPlotsInterestSubtotal)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Financial Breakdown Live Summary Box */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-sm border border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Base Price ({totalPlotsCountEquivalent} Plots)
                        </span>
                        <span className="text-sm font-bold text-white">
                          {formatGHS(effectiveBaseLandPrice)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {fullPlotsCount} Full, {halfPlotsCount} Half
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Terms / Interest
                        </span>
                        <span className="text-sm font-bold text-slate-200">
                          {paymentTerms === 'OUTRIGHT'
                            ? 'Outright (GH₵ 0.00)'
                            : `${instalmentMonths} Mo (+${formatGHS(calculatedInterestAmount)})`}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {paymentTerms === 'OUTRIGHT' ? 'Single Settlement' : `${instalmentMonths} Months Deferred`}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Total Amount Payable
                        </span>
                        <span className="text-base font-extrabold text-white">
                          {formatGHS(totalAgreedAmount)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Base + Interest
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Monthly Instalment
                        </span>
                        <span className="text-sm font-bold text-slate-200">
                          {paymentTerms === 'INSTALMENT'
                            ? `${formatGHS(monthlyInstalmentAmount)} / mo`
                            : 'N/A'}
                        </span>
                        {paymentTerms === 'INSTALMENT' && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Amortized over {instalmentMonths} mos
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Initial Deposit Paid (GH₵)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={totalAgreedAmount}
                          value={initialDeposit}
                          onChange={(e) => setInitialDeposit(e.target.value)}
                          placeholder="e.g. 20000"
                          className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Outstanding Balance Remaining
                        </span>
                        <span className="text-base font-extrabold text-amber-400 font-mono">
                          {formatGHS(remainingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Registering Customer...' : 'Complete Customer Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Edit className="h-5 w-5 text-amber-400" />
                  <span>Edit Customer Details</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Update client biodata, telephone, residential address, or identification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close edit modal"
                aria-label="Close"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {editSuccessMsg && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Other Names</label>
                  <input
                    type="text"
                    value={editOtherNames}
                    onChange={(e) => setEditOtherNames(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telephone *</label>
                  <input
                    type="tel"
                    required
                    value={editTelephone}
                    onChange={(e) => setEditTelephone(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={editAltTelephone}
                    onChange={(e) => setEditAltTelephone(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={editOccupation}
                    onChange={(e) => setEditOccupation(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">National ID Type</label>
                  <select
                    value={editIdType}
                    onChange={(e) => setEditIdType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-none"
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
                    value={editIdNumber}
                    onChange={(e) => setEditIdNumber(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Residential Address *</label>
                  <input
                    type="text"
                    required
                    value={editResidentialAddress}
                    onChange={(e) => setEditResidentialAddress(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ghana Post GPS</label>
                  <input
                    type="text"
                    value={editGpsAddress}
                    onChange={(e) => setEditGpsAddress(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Allocated Land Location & Plots (Reference) */}
              {editAllocations.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                      <Building className="h-4 w-4 text-amber-500" />
                      <span>Allocated Land & Plot Parcels ({editAllocations.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Site: <strong>{editAllocations[0]?.plot?.landLocation?.name || 'Assigned Site'}</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {editAllocations.map((alloc) => (
                      <span
                        key={alloc.id}
                        className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs font-mono"
                      >
                        {formatPlotLabel(alloc.plot?.plotNumber)} ({alloc.plot?.plotType === 'HALF_PLOT' ? 'Half Plot' : 'Full Plot'})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing, Terms of Payment & Financial Schedule */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Payment Terms & Instalment Schedule</h4>
                    <p className="text-[11px] text-slate-500">
                      Edit the payment plan. Calculations update live; payments already made remain strictly locked.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Ghana Real Estate Standard Formula
                  </span>
                </div>

                {/* Terms Toggle: Outright vs Instalment */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditPaymentTerms('OUTRIGHT')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      editPaymentTerms === 'OUTRIGHT'
                        ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Outright Payment</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Interest-Free
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Full single settlement</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPaymentTerms('INSTALMENT')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      editPaymentTerms === 'INSTALMENT'
                        ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Instalment Payment Plan</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Deferred
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">3, 6, 9, or 12 months duration</p>
                  </button>
                </div>

                {/* If Instalment: Duration Selector */}
                {editPaymentTerms === 'INSTALMENT' && (
                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/70 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      Select Instalment Duration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { months: 3, label: '3 Months', note: 'Interest-Free' },
                        { months: 6, label: '6 Months', note: 'Standard' },
                        { months: 9, label: '9 Months', note: 'Standard' },
                        { months: 12, label: '12 Months', note: 'Standard' },
                      ].map((opt) => (
                        <button
                          key={opt.months}
                          type="button"
                          onClick={() => setEditInstalmentMonths(opt.months)}
                          className={`p-2 rounded-lg text-center border transition cursor-pointer ${
                            editInstalmentMonths === opt.months
                              ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="block text-xs font-bold">{opt.label}</span>
                          <span className="block text-[9px] opacity-80 mt-0.5">{opt.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Custom Discount / Total Agreed Price */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editCustomPriceEnabled}
                      onChange={(e) => setEditCustomPriceEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>Enable Custom Price / Discount</span>
                  </label>
                  {editCustomPriceEnabled && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-500">Custom Total (GH₵):</span>
                      <input
                        type="number"
                        min="0"
                        value={editCustomTotalAgreed}
                        onChange={(e) => setEditCustomTotalAgreed(e.target.value)}
                        placeholder={String(editCalculatedTotalPayable)}
                        className="w-36 p-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Live Financial Calculation Box */}
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-sm border border-slate-800">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Base Plot Price
                      </span>
                      <span className="text-sm font-bold text-white">
                        {formatGHS(editComputedBasePrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {editAllocations.length} {editAllocations.length === 1 ? 'Plot' : 'Plots'} Total
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Terms / Interest
                      </span>
                      <span className="text-sm font-bold text-slate-200">
                        {editPaymentTerms === 'OUTRIGHT'
                          ? 'Outright (GH₵ 0.00)'
                          : `${editInstalmentMonths} Mo (+${formatGHS(editComputedInterest)})`}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {editPaymentTerms === 'OUTRIGHT' ? 'Single Settlement' : `${editInstalmentMonths} Months Deferred`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Total Amount Payable
                      </span>
                      <span className="text-base font-extrabold text-white">
                        {formatGHS(editCalculatedTotalPayable)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Base + Interest
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Monthly Instalment
                      </span>
                      <span className="text-sm font-bold text-slate-200">
                        {editPaymentTerms === 'INSTALMENT'
                          ? `${formatGHS(editMonthlyInstalment)} / mo`
                          : 'N/A'}
                      </span>
                      {editPaymentTerms === 'INSTALMENT' && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Amortized over {editInstalmentMonths} mos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Protection: Payments Made strictly read-only */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 items-center">
                    <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                          Payments Made So Far
                        </span>
                        <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                          Non-Editable
                        </span>
                      </div>
                      <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                        {formatGHS(editTotalPaid)}
                      </span>
                      <span className="text-[9px] text-slate-400 block">
                        * Recorded financial receipts cannot be modified from profile edit.
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold block">
                        New Outstanding Balance
                      </span>
                      <span className="text-base font-extrabold text-amber-400 font-mono mt-0.5 block">
                        {formatGHS(editOutstandingBalance)}
                      </span>
                      <span className="text-[9px] text-slate-400 block">
                        Automatically recalculated upon saving.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-900 text-white p-5">
              <div className="flex items-center space-x-3">
                {selectedCustomer.photographs?.[0]?.fileUrl || selectedCustomer.primaryPhotoUrl ? (
                  <img
                    src={selectedCustomer.photographs?.[0]?.fileUrl || selectedCustomer.primaryPhotoUrl}
                    alt={selectedCustomer.firstName}
                    className="h-14 w-14 rounded-full object-cover border-2 border-amber-500 shadow"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-slate-800 text-amber-400 font-bold text-lg flex items-center justify-center border border-slate-700">
                    {selectedCustomer.firstName?.[0]}
                    {selectedCustomer.lastName?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedCustomer.firstName} {selectedCustomer.lastName} {selectedCustomer.otherNames || ''}
                  </h3>
                  <p className="text-xs text-amber-400 font-mono">{selectedCustomer.customerNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close profile drawer"
                aria-label="Close"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Telephone</span>
                  <span className="font-semibold text-slate-900">{selectedCustomer.telephone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                  <span className="font-semibold text-slate-900">{selectedCustomer.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Residential Address</span>
                  <span className="font-semibold text-slate-900">{selectedCustomer.residentialAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ghana Card ID</span>
                  <span className="font-semibold text-slate-900 font-mono">{selectedCustomer.idNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ghana Post GPS</span>
                  <span className="font-semibold text-slate-900 font-mono">{selectedCustomer.gpsAddress || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date of Birth</span>
                  <span className="font-semibold text-slate-900">
                    {selectedCustomer.dateOfBirth
                      ? new Date(selectedCustomer.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Occupation</span>
                  <span className="font-semibold text-slate-900">{selectedCustomer.occupation || 'N/A'}</span>
                </div>
              </div>

              {/* Financial Rollup */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">Financial Ledger Summary</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-500 text-[10px] font-semibold">Total Agreed Price</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {formatGHS(selectedCustomer.financials?.totalAgreedPrice || selectedCustomer.ledger?.totalAgreedPrice || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-500 text-[10px] font-semibold">Total Paid</span>
                    <p className="font-bold text-emerald-600 text-sm mt-0.5">
                      {formatGHS(selectedCustomer.financials?.totalAmountPaid || selectedCustomer.ledger?.totalAmountPaid || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-500 text-[10px] font-semibold">Outstanding Balance</span>
                    <p className="font-bold text-amber-600 text-sm mt-0.5">
                      {formatGHS(selectedCustomer.financials?.outstandingBalance || selectedCustomer.ledger?.totalOutstandingBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Allocated Plots */}
              {selectedCustomer.allocations && selectedCustomer.allocations.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-2">Allocated Plots ({selectedCustomer.allocations.length})</h4>
                  <div className="space-y-2">
                    {selectedCustomer.allocations.map((alloc: any) => (
                      <div
                        key={alloc.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-xs">{formatPlotLabel(alloc.plot?.plotNumber)}</span>
                          <span className="text-slate-500 text-[11px] ml-2">
                            ({alloc.plot?.landLocation?.name || 'Assigned Location'})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 text-xs block">{formatGHS(alloc.agreedPrice)}</span>
                          <span className="text-[10px] text-emerald-600">
                            Paid: {formatGHS(alloc.totalAmountPaid)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditModal(selectedCustomer);
                    setSelectedCustomer(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 transition cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintCustomer(selectedCustomer);
                    setSelectedCustomer(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Form (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendCustomer(selectedCustomer);
                    setSelectedCustomer(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Send Form</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {printCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
          {/* Printable Page Card */}
          <div className="w-full max-w-[210mm] rounded-2xl bg-white shadow-2xl border border-slate-300 my-6 overflow-hidden flex flex-col print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none print:overflow-visible">
            {/* Top Toolbar (Hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white px-6 py-3 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-xs text-white">
                  Customer Application & Plot Acquisition Deed (A4 Print Preview)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(printCustomer)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Send via WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendEmail(printCustomer)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send via Email</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleDownloadPdf(printCustomer)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  title="Download ultra-sharp official PDF directly to device"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating Sharp PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center space-x-1.5"
                  title="Open system print preview (Vector Sharp)"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintCustomer(null)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition shadow cursor-pointer group"
                  title="Close print preview"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Viewport Wrapper for Crisp On-Screen Preview */}
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible bg-slate-100/80 p-2 sm:p-5">
              {/* Isolated Natural-Height A4 Sheet Proportioned Document */}
              <div
                id="official-customer-certificate-document"
                className="max-w-[794px] mx-auto bg-white text-slate-900 p-6 sm:p-7 space-y-3 font-sans shadow-lg print:shadow-none print:max-w-none print:p-0 print:m-0 w-full"
              >
                <style jsx global>{`
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 8mm 10mm;
                    }
                    html, body {
                      margin: 0 !important;
                      padding: 0 !important;
                      height: auto !important;
                      min-height: 100% !important;
                      overflow: visible !important;
                      background: #ffffff !important;
                      color: #000000 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      -webkit-font-smoothing: antialiased !important;
                      text-rendering: geometricPrecision !important;
                    }
                    body > *:not(#__next),
                    #__next > *:not(main),
                    .print\\:hidden {
                      display: none !important;
                    }
                    #official-customer-certificate-document {
                      visibility: visible !important;
                      display: block !important;
                      position: static !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: #ffffff !important;
                      overflow: visible !important;
                      max-height: none !important;
                    }
                    #official-customer-certificate-document * {
                      visibility: visible !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                    .print-break-avoid {
                      break-inside: avoid !important;
                      page-break-inside: avoid !important;
                    }
                  }
                `}</style>

                {/* Letterhead */}
                <div className="print-break-avoid border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-slate-950 leading-tight">
                      REAL ESTATE DEVELOPMENT GHANA LTD
                    </h2>
                    <p className="text-xs text-slate-700 font-semibold leading-tight mt-0.5">
                      Corporate Head Office: 14 Kofi Annan Street, Airport Residential Area, Accra
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tel: +233 (0) 244 000 001 | Email: info@realestatedev.gh | Web: www.realestatedev.gh
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded shadow-sm">
                      {printCustomer.customerNumber || 'CUST-FORM'}
                    </span>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      Issue Date: {new Date(printCustomer.createdAt || Date.now()).toLocaleDateString('en-GB')}
                    </p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 rounded">
                      Official Document
                    </span>
                  </div>
                </div>

                {/* Document Title Banner */}
                <div className="print-break-avoid text-center py-2 px-3 bg-slate-100 rounded-md border-y-2 border-slate-900">
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                    OFFICIAL CUSTOMER REGISTRATION & LAND ACQUISITION DEED
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Statutory Application Form & Parcel Allocation Record pursuant to Lands Commission Act 2020 (Act 1036)
                  </p>
                </div>

                {/* Section 1: Customer Personal Details & Photograph */}
                <div className="print-break-avoid space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    1. Applicant Particulars & Identification
                  </h4>
                  <div className="flex items-start space-x-4 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                    {printCustomer.photographs?.[0]?.fileUrl || printCustomer.primaryPhotoUrl ? (
                      <img
                        src={printCustomer.photographs?.[0]?.fileUrl || printCustomer.primaryPhotoUrl}
                        alt={printCustomer.firstName}
                        className="h-28 w-24 object-cover rounded-lg border-2 border-slate-400 shadow-sm"
                      />
                    ) : (
                      <div className="h-28 w-24 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs font-bold text-center p-2">
                        <Users className="h-6 w-6 mb-1 text-slate-300" />
                        <span>Passport Photograph</span>
                      </div>
                    )}

                    <div className="flex-1 grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Full Legal Name:</span>
                        <strong className="text-slate-950 text-sm block">
                          {printCustomer.firstName} {printCustomer.lastName} {printCustomer.otherNames || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Date of Birth:</span>
                        <strong className="text-slate-950 text-xs block">
                          {printCustomer.dateOfBirth
                            ? new Date(printCustomer.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Not Specified'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">National ID / Ghana Card:</span>
                        <strong className="text-slate-950 font-mono text-xs block">{printCustomer.idNumber || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Primary Telephone:</span>
                        <strong className="text-slate-950 text-xs block">{printCustomer.telephone}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Alternate Contact:</span>
                        <span className="text-slate-900 font-medium">{printCustomer.altTelephone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Email Address:</span>
                        <span className="text-slate-900 font-medium">{printCustomer.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Occupation / Profession:</span>
                        <span className="text-slate-900 font-medium">{printCustomer.occupation || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[11px] text-slate-500 font-semibold uppercase block">Residential Address:</span>
                        <span className="text-slate-900 font-medium">{printCustomer.residentialAddress}</span>
                      </div>
                      {printCustomer.gpsAddress && (
                        <div className="col-span-2">
                          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Ghana Digital Post GPS Address:</span>
                          <strong className="text-slate-950 font-mono">{printCustomer.gpsAddress}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Land Location & Allocated Plots */}
                <div className="print-break-avoid space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    2. Land Location & Allocated Plot(s)
                  </h4>
                  {printCustomer.allocations && printCustomer.allocations.length > 0 ? (
                    <div className="rounded-xl border border-slate-300 overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                          <tr>
                            <th className="py-2 px-2.5">Land Location Site</th>
                            <th className="py-2 px-2.5">Allocated Plot Number(s)</th>
                            <th className="py-2 px-2.5">Parcel Dimensions</th>
                            <th className="py-2 px-2.5 text-right">Agreed Consideration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {printCustomer.allocations.map((a: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-2.5 font-bold text-slate-900">
                                {a.plot?.landLocation?.name || 'Registered Site'}
                              </td>
                              <td className="py-2 px-2.5 font-mono font-extrabold text-slate-950">
                                {formatPlotLabel(a.plot?.plotNumber)}
                              </td>
                              <td className="py-2 px-2.5 text-slate-700">
                                {a.allocationType === 'HALF_PLOT' ? 'Half Plot (50ft x 70ft)' : 'Full Plot (70ft x 100ft)'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-black text-slate-950">{formatGHS(a.agreedPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                      No plot allocated yet. Registered under general customer account.
                    </div>
                  )}
                </div>

                {/* Section 3: Financial Consideration & Payment Schedule */}
                <div className="print-break-avoid space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    3. Financial Consideration & Terms of Payment
                  </h4>
                  <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-300 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase block">Payment Term:</span>
                      <strong className="text-slate-950 text-xs font-bold block">{printCustomer.paymentTerm || 'Outright'}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase block">Total Agreed Price:</span>
                      <strong className="font-black text-slate-950 text-xs sm:text-sm block">
                        {formatGHS(printCustomer.financials?.totalAgreedPrice || printCustomer.ledger?.totalAgreedPrice || 0)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase block">Amount Paid / Deposit:</span>
                      <strong className="font-black text-emerald-700 text-xs sm:text-sm block">
                        {formatGHS(printCustomer.financials?.totalAmountPaid || printCustomer.ledger?.totalAmountPaid || 0)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase block">Outstanding Balance:</span>
                      <strong className="font-black text-amber-700 text-xs sm:text-sm block">
                        {formatGHS(printCustomer.financials?.outstandingBalance || printCustomer.ledger?.totalOutstandingBalance || 0)}
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 italic leading-relaxed pt-0.5">
                    * Governing Real Estate Financial Terms: Outright purchases are interest-free. Instalment plans carry an interest surcharge of GH₵1,000 per full plot and GH₵500 per half plot for each 3-month cycle commencing after the initial 3-month grace period.
                  </p>
                </div>

                {/* Section 4: Declaration & Execution Signatures */}
                <div className="print-break-avoid space-y-2.5 pt-2 border-t-2 border-slate-900">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <strong>Statutory Declaration:</strong> I/We hereby apply for the plot(s) detailed above under the governing terms of Real Estate Development Ghana Ltd and pursuant to the Lands Commission Act 2020 (Act 1036). I/We certify that all information provided herein is accurate and complete, and acknowledge the covenants, conditions, and payment schedule herein.
                  </div>

                  {/* Generous Formal Execution Signature Pods */}
                  <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
                    {/* Pod 1: Applicant */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[170px] shadow-2xs">
                      <span className="font-bold text-[11px] sm:text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wider">
                        Applicant / Purchaser
                      </span>
                      <div className="py-3 text-center my-auto">
                        <div className="h-10 flex items-end justify-center">
                          <div className="w-full border-b-2 border-slate-800 border-dashed" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-1">Authorized Client Signature</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2.5 text-xs text-slate-700 space-y-1">
                        <div className="flex items-baseline space-x-1 min-h-[22px]">
                          <span className="text-slate-500 font-medium shrink-0">Name:</span>
                          <span className="text-slate-950 font-bold text-xs sm:text-[13px] leading-snug break-words">
                            {printCustomer.firstName} {printCustomer.lastName}
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-1 min-h-[20px]">
                          <span className="text-slate-500 font-medium shrink-0">Date:</span>
                          <span className="text-slate-900 font-medium font-mono text-xs">_____ / _____ / 20____</span>
                        </div>
                      </div>
                    </div>

                    {/* Pod 2: Sales Agent / Witness */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[170px] shadow-2xs">
                      <span className="font-bold text-[11px] sm:text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wider">
                        Sales Agent / Witness
                      </span>
                      <div className="py-3 text-center my-auto">
                        <div className="h-10 flex items-end justify-center">
                          <div className="w-full border-b-2 border-slate-800 border-dashed" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-1">Witness Attestation Signature</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2.5 text-xs text-slate-700 space-y-1">
                        <div className="flex items-baseline space-x-1 min-h-[22px]">
                          <span className="text-slate-500 font-medium shrink-0">Name:</span>
                          <span className="text-slate-950 font-bold text-xs sm:text-[13px] leading-snug break-words">
                            &nbsp;
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-1 min-h-[20px]">
                          <span className="text-slate-500 font-medium shrink-0">Date:</span>
                          <span className="text-slate-900 font-medium font-mono text-xs">_____ / _____ / 20____</span>
                        </div>
                      </div>
                    </div>

                    {/* Pod 3: Managing Director / Corporate Seal */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between min-h-[170px] shadow-2xs">
                      <span className="font-bold text-[11px] sm:text-xs uppercase text-slate-900 border-b border-slate-200 pb-1.5 text-center block tracking-wider">
                        Managing Director / Seal
                      </span>
                      <div className="py-3 text-center my-auto">
                        <div className="h-10 flex items-end justify-center">
                          <div className="w-full border-b-2 border-slate-800 border-dashed" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-1">Executive Approval Signature</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2.5 text-xs text-slate-700 space-y-1">
                        <div className="flex items-baseline space-x-1 min-h-[22px]">
                          <span className="text-slate-500 font-medium shrink-0">Name:</span>
                          <span className="text-slate-950 font-bold text-xs sm:text-[13px] leading-snug break-words">
                            &nbsp;
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-1 min-h-[20px]">
                          <span className="text-slate-500 font-medium shrink-0">Date:</span>
                          <span className="text-slate-900 font-medium font-mono text-xs">_____ / _____ / 20____</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Official Corporate Seal Pod */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-800 uppercase block text-[11px]">Official Corporate Endorsement:</span>
                      <span className="text-[11px]">This application deed is recorded in the Lands Registry Database of Real Estate Development Ghana Ltd.</span>
                    </div>
                    <div className="h-12 w-36 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-slate-400 text-center font-bold text-[10px] uppercase">
                      Affix Official Seal / Stamp Here
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 2B. MOVE CUSTOMER TO TRASH MODAL */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-red-50 p-5">
              <div className="flex items-center space-x-2 text-red-700">
                <Trash2 className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">Move Customer to Trash?</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Are you sure you want to delete customer{' '}
                <strong className="text-slate-900 font-bold">
                  {customerToDelete.firstName} {customerToDelete.lastName}
                </strong>{' '}
                (<span className="font-mono text-slate-700">{customerToDelete.customerNumber}</span>)?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-slate-600">
                <p>
                  <strong>Contact:</strong> {customerToDelete.telephone}
                </p>
                <p>
                  <strong>Location:</strong> {customerToDelete.primaryLocation || 'Unassigned'}
                </p>
                <p>
                  <strong>Agreed Value:</strong> {formatGHS(customerToDelete.financials?.totalAgreedPrice || 0)}
                </p>
              </div>
              <p className="text-slate-500 text-[11px]">
                The customer will be removed from the active CRM table and placed in the <strong>Trash</strong> archive. You can restore them or permanently erase them from the Trash view.
              </p>

              {formError && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                  {formError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Deleting...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2C. PERMANENT DELETE MODAL */}
      {/* ========================================================================= */}
      {isPermanentDeleteModalOpen && customerToPermanentlyDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-red-300 overflow-hidden">
            <div className="flex items-center justify-between border-b border-red-200 bg-red-600 text-white p-5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Permanently Erase Record?</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPermanentDeleteModalOpen(false)}
                className="text-white/80 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <p className="text-slate-800 leading-relaxed font-semibold">
                This action is IRREVERSIBLE and cannot be undone.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Permanently deleting{' '}
                <strong className="text-slate-900 font-bold">
                  {customerToPermanentlyDelete.firstName} {customerToPermanentlyDelete.lastName}
                </strong>{' '}
                (<span className="font-mono text-slate-700">{customerToPermanentlyDelete.customerNumber}</span>) will completely erase all associated allocations, invoices, payments, receipts, KYC photographs, and documentation from the database.
              </p>
              <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px]">
                Any plots allocated to this customer will be returned to <strong>AVAILABLE</strong> inventory status.
              </p>

              {formError && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                  {formError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsPermanentDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Permanently Erasing...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2D. ACTIVATE CUSTOMER FOR REFUND MODAL */}
      {/* ========================================================================= */}
      {isRefundModalOpen && refundCustomer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-4 sm:my-8 overflow-hidden flex flex-col">
            {/* Header: Anchored cleanly at the top so it never clips or disappears */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-purple-200 bg-slate-900 text-white px-6 py-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Activate Customer for Refund</h3>
                  <p className="text-xs text-purple-200 mt-0.5">
                    Quarantine allocation and transfer case to Executive Refund Workflow
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 hover:border-red-500 transition-all shadow cursor-pointer group"
                title="Close modal"
              >
                <X className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {formError}
              </div>
            )}

            {refundSuccessMsg && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{refundSuccessMsg}</span>
              </div>
            )}

            {(() => {
              const selectedAlloc =
                refundCustomer.allocations?.find(
                  (a: any) =>
                    (a.plotId && a.plotId === refundPlotId) ||
                    (a.plot?.id && a.plot?.id === refundPlotId) ||
                    (a.id && a.id === refundPlotId),
                ) || refundCustomer.allocations?.[0];

              const allocPaid = selectedAlloc
                ? Number(selectedAlloc.totalAmountPaid || 0)
                : Number(
                    refundCustomer.financials?.totalAmountPaid ||
                      refundCustomer.allocations?.reduce(
                        (sum: number, a: any) => sum + Number(a.totalAmountPaid || 0),
                        0,
                      ) ||
                      0,
                  );

              const netPayable = Math.max(0, allocPaid - (Number(refundDeductionAmount) || 0));

              return (
                <form onSubmit={handleRefundSubmit} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
                  {/* Customer & Plot Summary */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block text-sm">
                          {refundCustomer.firstName} {refundCustomer.lastName} {refundCustomer.otherNames || ''}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono font-semibold">{refundCustomer.customerNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-medium block">
                          {refundCustomer.allocations && refundCustomer.allocations.length > 1
                            ? 'Selected Plot Payments:'
                            : 'Total Payments Received:'}
                        </span>
                        <span className="font-extrabold text-emerald-700 text-sm font-mono">
                          {formatGHS(allocPaid)}
                        </span>
                        {refundCustomer.allocations && refundCustomer.allocations.length > 1 && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Account Total: {formatGHS(refundCustomer.financials?.totalAmountPaid || 0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Plot Selection if multiple, or single allocation display */}
                    {refundCustomer.allocations && refundCustomer.allocations.length > 1 ? (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Select Plot Allocation to Refund *
                        </label>
                        <select
                          value={refundPlotId}
                          onChange={(e) => setRefundPlotId(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:border-purple-500 focus:outline-none"
                        >
                          {refundCustomer.allocations.map((alloc: any) => {
                            const val = alloc.plotId || alloc.plot?.id || alloc.id;
                            return (
                              <option key={alloc.id} value={val}>
                                {formatPlotLabel(alloc.plot?.plotNumber)} — {alloc.plot?.landLocation?.name || 'Site'} (Paid: {formatGHS(alloc.totalAmountPaid)})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Allocated Plot for Refund</span>
                          <span className="text-xs font-bold text-slate-900">
                            {refundCustomer.allocations?.[0]
                              ? `${formatPlotLabel(refundCustomer.allocations[0].plot?.plotNumber)} — ${refundCustomer.allocations[0].plot?.landLocation?.name || 'Site'}`
                              : 'General Customer Account'}
                          </span>
                        </div>
                        {refundCustomer.allocations?.[0] && (
                          <span className="text-[11px] text-emerald-700 font-bold font-mono">
                            Paid: {formatGHS(refundCustomer.allocations[0].totalAmountPaid)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reason for Refund */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Reason for Refund * (Minimum 10 characters)
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. Customer relocating overseas and unable to complete instalment payments..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none text-xs text-slate-900"
                    />
                  </div>

                  {/* Deductions (Optional) */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Proposed Deductions (GH₵)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={refundDeductionAmount}
                        onChange={(e) => setRefundDeductionAmount(e.target.value)}
                        placeholder="0"
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deduction Explanation
                      </label>
                      <input
                        type="text"
                        value={refundDeductionReason}
                        onChange={(e) => setRefundDeductionReason(e.target.value)}
                        placeholder="e.g. 5% administrative fee"
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Net Refund Payable Banner */}
                  <div className="p-3.5 rounded-xl bg-purple-900 text-white flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">
                        Estimated Net Refund Payable
                      </span>
                      <span className="text-xs text-purple-200">
                        Selected Plot Payments ({formatGHS(allocPaid)}) minus Deductions ({formatGHS(Number(refundDeductionAmount) || 0)})
                      </span>
                    </div>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      {formatGHS(netPayable)}
                    </span>
                  </div>

                  {/* Policy Warning */}
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-[11px] text-purple-950 flex items-start space-x-2">
                    <ShieldAlert className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Activating this refund will set the customer's status to <strong>REFUNDED</strong>, quarantine the physical parcel beacon into <strong>CANCELLED</strong> status, and move this record from Customer CRM to the <strong>Customer Refund Workflow</strong> section for Managing Director audit and disbursement.
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsRefundModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition border border-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 transition"
                    >
                      {isSubmitting ? 'Activating Refund...' : 'Activate Refund & Transfer'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT CUSTOMER DETAILS MODAL */}
    </div>
  );
}
