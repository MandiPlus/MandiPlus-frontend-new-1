"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "../auth/components/ProtectedRoute";
import { useAuth } from "../auth/context/AuthContext";
import {
  getMyInsuranceForms,
  regenerateInvoice,
  InsuranceForm,
  RegenerateInvoicePayload,
  uploadWeighmentSlips,
  updateInvoice,
  getMyClaimsForms,
  getAdminClaimsForms,
  ClaimRequest,
  CreateDamageFormDto,
  createClaimByTruck,
  uploadClaimMedia,
  submitDamageForm
} from "../insurance/api";
import {
  getMyWalletSummary,
  WalletSummary,
} from "../customer/api";
import 'cropperjs/dist/cropper.css';
import Cropper, { ReactCropperElement } from "react-cropper";
import { ArrowPathIcon, Bars3Icon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/";

const HomePage = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  // Invoice states
  const [invoices, setInvoices] = useState<InsuranceForm[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InsuranceForm | null>(null);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  // --- ✅ NEW: Claims States ---
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [newClaimTruckNo, setNewClaimTruckNo] = useState('');
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [statusLookupInput, setStatusLookupInput] = useState('');
  const [statusLookupResult, setStatusLookupResult] = useState<ClaimRequest | null>(null);
  const [statusLookupError, setStatusLookupError] = useState<string | null>(null);
  const [showClaimInvoiceModal, setShowClaimInvoiceModal] = useState(false);
  const [selectedClaimForInvoice, setSelectedClaimForInvoice] = useState<ClaimRequest | null>(null);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);
  const [createdClaim, setCreatedClaim] = useState<ClaimRequest | null>(null);

  // --- ✅ NEW: Damage Form States ---
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedClaimForDamage, setSelectedClaimForDamage] = useState<ClaimRequest | null>(null);
  const [damageFormData, setDamageFormData] = useState<CreateDamageFormDto>({
    damageCertificateDate: new Date().toISOString().split('T')[0],
    transportReceiptMemoNo: '',
    transportReceiptDate: '',
    loadedWeightKg: 0,
    productName: '',
    fromParty: '',
    forParty: '',
    accidentDate: '',
    accidentLocation: '',
    accidentDescription: '',
    agreedDamageAmountNumber: 0,
    agreedDamageAmountWords: '',
    authorizedSignatoryName: '',
  });

  // --- Cropper & File State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeClaimIdForUpload, setActiveClaimIdForUpload] = useState<string | null>(null); // ✅ NEW
  const [activeMediaType, setActiveMediaType] = useState<'fir' | 'accidentPic' | 'lorryReceipt' | 'insurancePolicy' | null>(null); // ✅ NEW
  const [showClaimDetailModal, setShowClaimDetailModal] = useState(false); // ✅ NEW
  const [selectedClaimForDetail, setSelectedClaimForDetail] = useState<ClaimRequest | null>(null); // ✅ NEW

  const cropperRef = useRef<ReactCropperElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isCropperReady, setIsCropperReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [weightmentSlip, setWeightmentSlip] = useState<File | null>(null);

  // Regenerate form states
  const [formData, setFormData] = useState<RegenerateInvoicePayload>({
    invoiceId: '',
    supplierName: '',
    supplierAddress: [''],
    placeOfSupply: '',
    billToName: '',
    billToAddress: [''],
    shipToName: '',
    shipToAddress: [''],
    productName: '',
    hsnCode: '',
    quantity: 0,
    rate: 0,
    amount: 0,
    vehicleNumber: '',
    truckNumber: '',
    weighmentSlipNote: '',
    invoiceType: 'BUYER_INVOICE',
    invoiceDate: new Date().toISOString().split('T')[0],
  });
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isCustomer = user?.identity === "CUSTOMER";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value || 0);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const loadWalletData = async () => {
    if (!isCustomer) return;
    try {
      const walletData = await getMyWalletSummary();
      setWallet(walletData);
    } catch (err: any) {
      setWallet(null);
    }
  };

  useEffect(() => {
    loadWalletData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer]);

  // Fetch invoices when modal opens
  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await getMyInsuranceForms();
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchClaimsByRole = async (): Promise<ClaimRequest[]> => {
    if (user?.identity === "INTERNAL_TEAM") {
      return await getAdminClaimsForms();
    }
    // Non-internal users remain user-scoped.
    return await getMyClaimsForms();
  };

  // --- NEW: Fetch Claims ---
  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const data = await fetchClaimsByRole();
      setClaims(data);
    } catch (err: any) {
      console.error('Failed to fetch claims:', err);
      setError(err.message || 'Failed to load claims');
    } finally {
      setLoadingClaims(false);
    }
  };


  const handleOpenInvoiceModal = () => {
    setShowInvoiceModal(true);
    fetchInvoices();
  };

  // --- NEW: Open Claims Modal ---
  const handleOpenClaimsModal = () => {
    setShowClaimsModal(true);
    setStatusLookupInput('');
    setStatusLookupResult(null);
    setStatusLookupError(null);
    fetchClaims();
  };

  // --- NEW: Create Claim Handler ---
  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimTruckNo) return;
    setCreatingClaim(true);
    try {
      const newClaim = await createClaimByTruck(newClaimTruckNo);
      setNewClaimTruckNo('');
      setCreatedClaim(newClaim);
      setShowClaimSuccessModal(true);
      await fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to create claim. Ensure invoice exists.");
    } finally {
      setCreatingClaim(false);
    }
  };

  const handleCheckClaimStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = statusLookupInput.trim().toLowerCase();
    if (!query) {
      setStatusLookupResult(null);
      setStatusLookupError("Please enter claim id, invoice number, or truck number.");
      return;
    }

    const source = claims.length > 0 ? claims : await fetchClaimsByRole();
    if (claims.length === 0) {
      setClaims(source);
    }

    const matched = source.find((claim) => {
      const claimId = String(claim.id || '').toLowerCase();
      const invoiceNo = String(claim.invoice?.invoiceNumber || '').toLowerCase();
      const vehicleNo = String(claim.invoice?.vehicleNumber || '').toLowerCase();
      const truckNo = String(claim.invoice?.truckNumber || '').toLowerCase();
      return claimId.includes(query) || invoiceNo.includes(query) || vehicleNo.includes(query) || truckNo.includes(query);
    });

    if (!matched) {
      setStatusLookupResult(null);
      setStatusLookupError("No claim found for this reference.");
      return;
    }

    setStatusLookupError(null);
    setStatusLookupResult(matched);
  };

  // --- NEW: Upload Media Handler (Individual Media Types) ---
  const handleClaimMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && activeClaimIdForUpload && activeMediaType) {
      try {
        const file = e.target.files[0];
        await uploadClaimMedia(activeClaimIdForUpload, activeMediaType, file);
        alert("File uploaded successfully!");
        fetchClaims();
        // Refresh selected claim if detail modal is open
        if (selectedClaimForDetail && selectedClaimForDetail.id === activeClaimIdForUpload) {
          const updatedClaims = await fetchClaimsByRole();
          const updatedClaim = updatedClaims.find(c => c.id === activeClaimIdForUpload);
          if (updatedClaim) {
            setSelectedClaimForDetail(updatedClaim);
          }
        }
      } catch (err: any) {
        console.error("Upload failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to upload file.";
        alert(`Upload Failed: ${msg}`);
      } finally {
        setActiveClaimIdForUpload(null);
        setActiveMediaType(null);
        e.target.value = '';
      }
    }
  };

  const openClaimInvoiceModal = (claim: ClaimRequest) => {
    setSelectedClaimForInvoice(claim);
    setShowClaimInvoiceModal(true);
  };

  const openClaimDetailModal = (claim: ClaimRequest) => {
    setSelectedClaimForDetail(claim);
    setShowClaimDetailModal(true);
  };

  // --- NEW: Damage Form Logic ---
  const openDamageForm = (claim: ClaimRequest) => {
    // If damage form already exists, just show a message
    if (claim.damageFormUrl) {
      window.open(claim.damageFormUrl, '_blank');
      return;
    }
    setSelectedClaimForDamage(claim);
    setDamageFormData({
      damageCertificateDate: new Date().toISOString().split('T')[0],
      transportReceiptMemoNo: claim.invoice?.invoiceNumber || '',
      transportReceiptDate: claim.invoice?.createdAt
        ? new Date(claim.invoice.createdAt).toISOString().split('T')[0]
        : '',
      loadedWeightKg: claim.invoice?.quantity || 0,
      productName: claim.invoice?.productName?.[0] || '',
      fromParty: claim.invoice?.supplierName || '',
      forParty: claim.invoice?.billToName || '',
      accidentDate: '',
      accidentLocation: '',
      accidentDescription: '',
      agreedDamageAmountNumber: 0,
      agreedDamageAmountWords: '',
      authorizedSignatoryName: '',
    });
    setShowDamageModal(true);
  };

  const submitDamageFormHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimForDamage) return;
    try {
      await submitDamageForm(selectedClaimForDamage.id, damageFormData);
      alert("Damage form submitted! PDF generation queued.");
      setShowDamageModal(false);
      fetchClaims();
    } catch (err: any) {
      const errorMsg = Array.isArray(err.message) ? err.message.join(', ') : err.message || "Failed to submit damage form";
      alert(`Error: ${errorMsg}`);
    }
  };

  // --- NEW: Cropper Helper Functions ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsCropping(true);
        setIsCropperReady(false);
        setRotation(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const rotateImage = (degrees: number) => {
    setRotation(prev => (prev + degrees) % 360);
    cropperRef.current?.cropper.rotateTo(rotation + degrees);
  };

  const handleCropComplete = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas({
      minWidth: 300, minHeight: 300, maxWidth: 4096, maxHeight: 4096,
      fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
    }).toBlob(blob => {
      if (blob) {
        setWeightmentSlip(new File([blob], 'updated-weightment-slip.jpg', { type: 'image/jpeg' }));
        setIsCropping(false);
        setImageSrc(null);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleEditInvoice = (invoice: InsuranceForm) => {
    setSelectedInvoice(invoice);
    setWeightmentSlip(null); // Reset file
    setFormData({
      invoiceId: invoice.id,
      supplierName: invoice.supplierName,
      supplierAddress: invoice.supplierAddress || [''],
      placeOfSupply: invoice.placeOfSupply,
      billToName: invoice.billToName,
      billToAddress: invoice.billToAddress || [''],
      shipToName: invoice.shipToName || '',
      shipToAddress: invoice.shipToAddress || [''],
      productName: Array.isArray(invoice.productName)
        ? invoice.productName[0] || ''
        : invoice.productName || '', hsnCode: invoice.hsnCode || '',
      quantity: invoice.quantity || 0,
      rate: invoice.rate || 0,
      amount: invoice.amount || 0,
      vehicleNumber: invoice.vehicleNumber || '',
      truckNumber: invoice.truckNumber || '',
      weighmentSlipNote: invoice.weighmentSlipNote || '',
      invoiceType: 'BUYER_INVOICE', // Default to BUYER_INVOICE since invoiceType doesn't exist on InsuranceForm
      invoiceDate: invoice.createdAt
        ? new Date(invoice.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    });
    setShowRegenerateForm(true);
  };

  // --- NEW: Updated Submit Logic ---
  const handleRegenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setRegenerating(true);
    setError(null);

    try {
      // 1. Upload Image if exists
      if (weightmentSlip) {
        await uploadWeighmentSlips(selectedInvoice.id, [weightmentSlip]);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for PDF generation
      }

      // 2. Prepare FormData
      const payload = new FormData();
      const append = (key: string, value: any) => payload.append(key, String(value ?? ''));

      append('invoiceType', formData.invoiceType);
      append('invoiceDate', formData.invoiceDate);
      append('supplierName', formData.supplierName);
      append('placeOfSupply', formData.placeOfSupply);
      append('billToName', formData.billToName);
      append('shipToName', formData.shipToName);
      append('hsnCode', formData.hsnCode);
      append('vehicleNumber', formData.vehicleNumber);
      append('truckNumber', formData.truckNumber);
      append('weighmentSlipNote', formData.weighmentSlipNote);
      append('productName', formData.productName);
      append('quantity', formData.quantity);
      append('rate', formData.rate);
      append('amount', (Number(formData.quantity) || 0) * (Number(formData.rate) || 0));

      const processArray = (key: string, arr: any) => {
        const valid = Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [String(arr || '')];
        valid.forEach(v => payload.append(key, v));
      };
      processArray('supplierAddress', formData.supplierAddress);
      processArray('billToAddress', formData.billToAddress);
      processArray('shipToAddress', formData.shipToAddress);

      // 3. Update Text
      await updateInvoice(selectedInvoice.id, payload);

      // 4. Final Wait & Refresh
      const fresh = await getMyInsuranceForms();
      setInvoices(fresh);

      alert('Invoice updated successfully!');
      setShowRegenerateForm(false);
      setSelectedInvoice(null);
      setWeightmentSlip(null);

    } catch (err: any) {
      const errorMsg = Array.isArray(err.message)
        ? err.message.join(', ')
        : err.message || 'Failed to regenerate invoice';
      setError(errorMsg);
    } finally {
      setRegenerating(false);
    }
  };

  const username = user?.mobileNumber || "user";
  const welcomeName = user?.name?.trim() || username;
  const welcomeMeta = user?.mobileNumber || user?.identity || "Account";

  const handleLogout = () => {
    logout();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <ProtectedRoute allowedIdentities={["BUYER", "SUPPLIER", "CUSTOMER", "INTERNAL_TEAM"]}>
      <div className="min-h-screen bg-[#e0d7fc] pb-28">

        {/* --- NEW: Cropper Overlay --- */}
        {isCropping && imageSrc && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="flex-1 w-full relative min-h-0 bg-black">
              <Cropper
                src={imageSrc} style={{ height: '100%', width: '100%' }} ref={cropperRef}
                guides={true} viewMode={1} dragMode="move" autoCropArea={1} checkOrientation={true}
                ready={() => { setIsCropperReady(true); setRotation(0); }}
              />
            </div>
            <div className="w-full bg-black/90 p-4 flex justify-between items-center px-6 z-50 border-t border-gray-800">
              <div className="flex gap-4 text-white">
                <button type="button" onClick={() => rotateImage(-90)}><ArrowPathIcon className="w-6 h-6 transform rotate-90" /></button>
                <button type="button" onClick={() => rotateImage(90)}><ArrowPathIcon className="w-6 h-6 -scale-x-100 transform rotate-90" /></button>
              </div>
              <div className="flex gap-6">
                <button type="button" onClick={() => { setIsCropping(false); setImageSrc(null); }} className="text-red-500"><XMarkIcon className="w-8 h-8" /></button>
                <button type="button" onClick={handleCropComplete} disabled={!isCropperReady} className={isCropperReady ? 'text-[#25D366]' : 'text-gray-500'}><CheckIcon className="w-8 h-8" /></button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-white text-black px-5 py-4 rounded-b-4xl relative">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center bg-white px-2 py-1 rounded-2xl -ml-2">
              <h2
                className="text-2xl font-bold tracking-tight -ml-10"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                <span className="text-slate-800">Mandi</span>
                <span className="text-[#4309ac]">Plus</span>
              </h2>
              <p className="text-xs font-medium">
                <span className="text-black">Risk Humara, </span>
                <span className="text-[#4309ac]">Munafa Aapka</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col items-end rounded-2xl border border-purple-200 bg-purple-50 px-3 py-2 text-right shadow-sm leading-tight">
                <p className="text-xs font-semibold tracking-wide text-purple-700">
                  Welcome {welcomeName}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {welcomeMeta}
                </p>
              </div>
              {isCustomer && (
                <button
                  type="button"
                  onClick={() => router.push("/customer/wallet")}
                  className="rounded-2xl border border-purple-200 bg-purple-50 px-3 py-2 text-right shadow-sm"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-700">Wallet</p>
                  <p className="text-xs font-bold text-slate-900">{formatCurrency(wallet?.availableBalance ?? 0)}</p>
                </button>
              )}
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 text-purple-900 p-2.5 rounded-2xl transition-all duration-300 ease-out border border-white border-opacity-20 active:scale-95"
              >
                <Bars3Icon className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 md:hidden">
            <div className="min-w-0 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 shadow-sm">
              <p className="truncate text-[11px] font-semibold text-[#4309ac]">
                Welcome {welcomeName}
              </p>
            </div>
            <p className="max-w-[45%] truncate text-right text-[10px] font-medium text-slate-500">
              {welcomeMeta}
            </p>
          </div>

          {/* Hamburger menu overlay + panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className={`fixed inset-0 z-50 transition-opacity duration-300 ease-out ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className={`absolute top-0 right-0 h-full w-full max-w-[280px] bg-white rounded-l-3xl shadow-xl flex flex-col transition-transform duration-300 ease-out ${
                menuOpen ? "translate-x-0" : "translate-x-full"
              }`}
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <span className="text-slate-800 font-semibold">Menu</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-xl text-slate-600 hover:bg-[#e0d7fc] hover:text-[#4309ac] transition-colors duration-200"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex flex-col py-2">
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center"
                >
                  Pricing
                </Link>
                <Link
                  href="/refund-policy"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center"
                >
                  Refund Policy
                </Link>
                <Link
                  href="/privacy-policy"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center"
                >
                  Privacy Policy
                </Link>
                {isCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/customer/wallet");
                    }}
                    className="px-5 py-3.5 text-left text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center"
                  >
                    Wallet
                  </button>
                )}
                <Link
                  href="/terms-and-conditions"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center"
                >
                  Terms &amp; Conditions
                </Link>
                <div className="border-t border-slate-100 my-2" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="px-5 py-3.5 text-left text-slate-800 hover:bg-[#e0d7fc]/50 hover:text-[#4309ac] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* SERVICES */}
        <div className="px-5 mt-5">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Our Services</h2>

          <div className="grid grid-cols-2 gap-4">
            <div
              className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
              onClick={() => router.push("/tracking")}
            >
              <h4 className="font-semibold mb-1 text-slate-800">Track Deliveries</h4>
              <p className="text-xs text-gray-500">Real-time updates</p>
            </div>

            <div
              className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
              onClick={() => router.push("/insurance")}
            >
              <h4 className="font-semibold mb-1 text-slate-800">Create Insurance Forms</h4>
              <p className="text-xs text-gray-500 mb-2">
                Get policy instantly
              </p>
            </div>

            <div
              className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
              onClick={() => router.push("/know-your-vehicle")}
            >
              <h4 className="font-semibold mb-1 text-slate-800">Know Your Vehicle</h4>
              <p className="text-xs text-gray-500">
                Check vehicle details
              </p>
            </div>

            <div
              className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
              onClick={handleOpenInvoiceModal}
            >
              <h4 className="font-semibold mb-1 text-slate-800">My Policies</h4>
              <p className="text-xs text-gray-500">View & Edit forms</p>
            </div>

            {/* NEW: My Claims Card */}
            <div
              className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
              onClick={handleOpenClaimsModal}
            >
              <h4 className="font-semibold mb-1 text-slate-800">My Claims</h4>
              <p className="text-xs text-gray-500">View & File Claims</p>
            </div>

            {isCustomer && (
              <div
                className="bg-white rounded-3xl p-4 shadow-sm cursor-pointer"
                onClick={() => router.push("/customer/wallet")}
              >
                <h4 className="font-semibold mb-1 text-slate-800">Wallet</h4>
                <p className="text-xs text-gray-500">View balance & statement</p>
              </div>
            )}
          </div>
        </div>

        {/* DO MORE */}
        <div className="px-5 mt-5">
          <h2
            className="text-2xl mb-2 font-bold tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            <span className="text-slate-800">Do more with Mandi</span>
            <span className="text-[#4309ac]">Plus</span>
          </h2>

          <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm text-slate-800">
                Explore our other Products
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                From all RTOs
              </p>
            </div>
            <span className="text-xl text-slate-800">→</span>
          </div>
        </div>

        {/* INVOICE LIST MODAL */}
        {showInvoiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl">
                <h3 className="text-xl font-bold text-slate-800">My Invoices</h3>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  
                </button>
              </div>

              <div className="p-6">
                {loadingInvoices ? (
                  <div className="text-center py-8 text-gray-500">Loading invoices...</div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No invoices found</div>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="border rounded-2xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-800">{invoice.invoiceNumber}</h4>
                            <p className="text-sm text-gray-600">{invoice.supplierName}</p>
                            <p className="text-xs text-gray-500">
                              {invoice.createdAt
                                ? new Date(invoice.createdAt).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-800">₹{invoice.amount?.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {invoice.pdfUrl && (
                            <a
                              href={`${invoice.pdfUrl}?t=${Date.now()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 text-center"
                            >
                              📄 View PDF
                            </a>
                          )}
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="flex-1 bg-[#4309ac] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#350889]"
                          >
                            ✏️ Edit & Regenerate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NEW: CLAIMS MODAL */}
        {showClaimsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl z-10">
                <h3 className="text-xl font-bold text-slate-800">My Claims</h3>
                <button onClick={() => setShowClaimsModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="p-6">
                {/* Create New Claim Section */}
                <div className="bg-purple-50 p-4 rounded-2xl mb-6">
                  <h4 className="font-semibold text-slate-800 mb-2">Create New Claim</h4>
                  <form onSubmit={handleCreateClaim} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Truck Number (e.g. MH12AB1234)"
                      value={newClaimTruckNo}
                      onChange={(e) => setNewClaimTruckNo(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4309ac] text-black"
                    />
                    <button
                      type="submit"
                      disabled={creatingClaim}
                      className="bg-[#4309ac] text-white px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                    >
                      {creatingClaim ? '...' : 'Create'}
                    </button>
                  </form>
                  <p className="text-xs text-gray-500 mt-2">Latest invoice for this truck will be used.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-2">Check Claim Status</h4>
                  <form onSubmit={handleCheckClaimStatus} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Claim ID / Invoice No / Truck No"
                      value={statusLookupInput}
                      onChange={(e) => setStatusLookupInput(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4309ac] text-black"
                    />
                    <button
                      type="submit"
                      className="bg-[#4309ac] text-white px-4 py-2 rounded-xl font-medium"
                    >
                      Check
                    </button>
                  </form>

                  {statusLookupError && (
                    <p className="text-xs text-rose-700 mt-2">{statusLookupError}</p>
                  )}

                  {statusLookupResult && (
                    <div className="mt-3 rounded-xl bg-white border border-gray-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">
                          {statusLookupResult.invoice?.invoiceNumber || statusLookupResult.id}
                        </p>
                        <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                          statusLookupResult.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : statusLookupResult.status === 'inprogress' || statusLookupResult.status === 'surveyor_assigned'
                            ? 'bg-blue-100 text-blue-800'
                            : statusLookupResult.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {statusLookupResult.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(statusLookupResult.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Claims List */}
                {loadingClaims ? (
                  <div className="text-center py-8 text-gray-500">Loading claims...</div>
                ) : claims.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No claims found</div>
                ) : (
                  <div className="space-y-4">
                    {claims.map((claim) => (
                      <div key={claim.id} className="border rounded-2xl p-4 hover:shadow-md transition-shadow relative">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold mb-1 ${
                              claim.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : claim.status === 'inprogress' || claim.status === 'surveyor_assigned'
                                ? 'bg-blue-100 text-blue-800'
                                : claim.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                              }`}>
                              {claim.status.replace('_', ' ')}
                            </span>
                            <h4 className="font-semibold text-slate-800">
                              {claim.invoice?.invoiceNumber || "Invoice N/A"}
                            </h4>
                            <p className="text-xs text-gray-500">Created: {new Date(claim.createdAt).toLocaleDateString()}</p>
                            {claim.surveyorName && (
                              <p className="text-xs text-purple-700 mt-1">👷 Surveyor: {claim.surveyorName} ({claim.surveyorContact})</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={() => openClaimDetailModal(claim)}
                            className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-medium hover:bg-blue-100 border border-blue-100 flex items-center gap-1"
                          >
                            📤 Submit Documents
                          </button>

                          <button
                            onClick={() => openClaimInvoiceModal(claim)}
                            className="bg-gray-50 text-gray-700 px-3 py-2 rounded-xl text-xs font-medium hover:bg-gray-100 border border-gray-200 flex items-center gap-1"
                          >
                            📄 Invoice
                          </button>

                          {claim.claimFormUrl && (
                            <a href={claim.claimFormUrl} target="_blank" className="bg-purple-50 text-purple-700 px-3 py-2 rounded-xl text-xs font-medium border border-purple-100">
                              📄 View Cert
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Hidden Input for Claim Media Upload */}
            <input
              type="file"
              id="claim-media-upload"
              className="hidden"
              onChange={handleClaimMediaUpload}
              accept="image/*,application/pdf,.doc,.docx"
            />
          </div>
        )}

        {/* NEW: CLAIM SUCCESS MODAL */}
        {showClaimSuccessModal && createdClaim && (
          <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 text-center shadow-2xl">
              {/* Success Icon with overlapping documents */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  {/* Back document */}
                  <div className="absolute top-2 left-2 w-20 h-20 bg-gray-300 rounded-lg transform rotate-6"></div>
                  {/* Front document with checkmark */}
                  <div className="relative w-20 h-20 bg-blue-50 rounded-lg flex items-center justify-center shadow-md">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <CheckIcon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  {/* Gradient line below */}
                  <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-24 h-1.5 bg-gradient-to-r from-blue-400 via-blue-500 to-green-500 rounded-full"></div>
                </div>
              </div>

              {/* Success Message */}
              <h2 className="text-xl font-bold text-slate-800 mb-3 leading-tight">
                Your claim has successfully registered.
              </h2>
              <p className="text-base text-slate-700 mb-2">
                Your claim number is <span className="font-bold text-blue-600">{createdClaim.invoice?.invoiceNumber || createdClaim.id.replace(/-/g, '').slice(0, 10)}</span>.
              </p>
              <p className="text-sm text-gray-600 mb-1">
                Please note this claim number for future reference.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Kindly upload the required documents to speed up your claim process.
              </p>

              {/* Upload Documents Button */}
              <button
                onClick={() => {
                  setShowClaimSuccessModal(false);
                  setSelectedClaimForDetail(createdClaim);
                  setShowClaimDetailModal(true);
                }}
                className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 text-white py-3.5 px-6 rounded-xl font-semibold text-base mb-4 hover:from-blue-600 hover:via-blue-700 hover:to-green-600 transition-all shadow-lg transform hover:scale-[1.02]"
              >
                Upload Documents
              </button>

              {/* Go Back Link */}
              <button
                onClick={() => {
                  setShowClaimSuccessModal(false);
                  setCreatedClaim(null);
                }}
                className="text-gray-500 text-sm hover:text-gray-700 underline"
              >
                Go back to home
              </button>
            </div>
          </div>
        )}

        {/* NEW: CLAIM INVOICE MODAL (for My Claims list) */}
        {showClaimInvoiceModal && selectedClaimForInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl">
                <h3 className="text-xl font-bold text-slate-800">Invoice Details</h3>
                <button
                  onClick={() => {
                    setShowClaimInvoiceModal(false);
                    setSelectedClaimForInvoice(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-3 text-sm text-slate-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Invoice Number</div>
                    <div className="font-semibold">
                      {selectedClaimForInvoice.invoice?.invoiceNumber || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Invoice Date</div>
                    <div>
                      {selectedClaimForInvoice.invoice?.createdAt
                        ? new Date(selectedClaimForInvoice.invoice.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Supplier</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.invoice?.supplierName || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Buyer</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.invoice?.billToName || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Truck Number</div>
                    <div>{selectedClaimForInvoice.invoice?.vehicleNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Quantity</div>
                    <div>{selectedClaimForInvoice.invoice?.quantity ?? 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div>₹ {selectedClaimForInvoice.invoice?.amount ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {selectedClaimForInvoice.invoice?.pdfUrl && (
                  <div className="pt-3">
                    <a
                      href={selectedClaimForInvoice.invoice.pdfUrl}
                      target="_blank"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      📄 Open Invoice PDF
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ NEW: CLAIM DETAIL MODAL (Media Management) */}
        {showClaimDetailModal && selectedClaimForDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl z-10">
                <h3 className="text-xl font-bold text-slate-800">Claim Documents</h3>
                <button onClick={() => setShowClaimDetailModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="p-6">
                {/* Claim Info */}
                <div className="mb-6 p-4 bg-purple-50 rounded-2xl">
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Invoice:</span> {selectedClaimForDetail.invoice?.invoiceNumber || 'N/A'}</div>
                    <div><span className="font-semibold">Truck:</span> {selectedClaimForDetail.invoice?.vehicleNumber || 'N/A'}</div>
                    <div><span className="font-semibold">Status:</span> 
                      <span className={`ml-2 inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                        selectedClaimForDetail.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedClaimForDetail.status === 'inprogress' || selectedClaimForDetail.status === 'surveyor_assigned'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedClaimForDetail.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedClaimForDetail.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Media Upload Sections */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-800 mb-3">Documents & Media</h4>
                  
                  {/* 1. Accident Picture */}
                  <UserMediaUploadSection
                    label="Accident Picture"
                    mediaType="accidentPic"
                    existingUrl={selectedClaimForDetail.accidentPic}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById('claim-media-upload')?.click();
                    }}
                  />

                  {/* 2. Damage Certificate (Billed by transporter) */}
                  <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Damage Certificate</span>
                      <span className="text-xs text-gray-500">(Filled by your transporter)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/pdf/example-damage-pdf/example-damage-cert.pdf"
                        download
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        📥 Download
                      </a>
                    </div>
                  </div>

                  {/* 3. FIR Document */}
                  <UserMediaUploadSection
                    label="FIR Document"
                    mediaType="fir"
                    existingUrl={selectedClaimForDetail.fir}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById('claim-media-upload')?.click();
                    }}
                  />

                  {/* 4. Insurance Policy */}
                  <UserMediaUploadSection
                    label="Insurance Policy"
                    mediaType="insurancePolicy"
                    existingUrl={selectedClaimForDetail.insurancePolicy}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById('claim-media-upload')?.click();
                    }}
                  />

                  {/* 5. Lorry Receipt */}
                  <UserMediaUploadSection
                    label="Lorry Receipt"
                    mediaType="lorryReceipt"
                    existingUrl={selectedClaimForDetail.lorryReceipt}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById('claim-media-upload')?.click();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* (Damage form modal removed for users; sample download provided in Claim Documents modal) */}

        {/* REGENERATE FORM MODAL */}
        {showRegenerateForm && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl">
                <h3 className="text-xl font-bold text-slate-800">Update Invoice</h3>
                <button
                  onClick={() => {
                    setShowRegenerateForm(false);
                    setSelectedInvoice(null);
                    setError(null);
                    setWeightmentSlip(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegenerateSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 text-sm">
                    {error}
                  </div>
                )}

                {/* --- NEW: Image Upload Section --- */}
                <div className="border border-gray-300 rounded-xl p-4">
                  <label className="block text-sm font-medium text-slate-800 mb-2">Upload Weighment Slip</label>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  <div className="flex flex-col gap-3">
                    {weightmentSlip ? (
                      <div className="text-green-700 text-sm bg-green-50 p-2 rounded">{weightmentSlip.name}</div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center">No new slip selected</div>
                    )}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                      📸 {weightmentSlip ? 'Replace Photo' : 'Upload New Photo'}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  Invoice: <span className="font-semibold">{selectedInvoice.invoiceNumber}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Invoice Type
                    </label>
                    <select
                      value={formData.invoiceType}
                      onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    >
                      <option value="BUYER_INVOICE">Buyer Invoice</option>
                      <option value="SUPPLIER_INVOICE">Supplier Invoice</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Supplier Address
                  </label>
                  <textarea
                    value={Array.isArray(formData.supplierAddress) ? formData.supplierAddress[0] : formData.supplierAddress}
                    onChange={(e) => setFormData({ ...formData, supplierAddress: [e.target.value] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter supplier address"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Bill To Name
                  </label>
                  <input
                    type="text"
                    value={formData.billToName}
                    onChange={(e) => setFormData({ ...formData, billToName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter buyer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Bill To Address
                  </label>
                  <textarea
                    value={Array.isArray(formData.billToAddress) ? formData.billToAddress[0] : formData.billToAddress}
                    onChange={(e) => setFormData({ ...formData, billToAddress: [e.target.value] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter buyer address"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Ship To Name
                  </label>
                  <input
                    type="text"
                    value={formData.shipToName}
                    onChange={(e) => setFormData({ ...formData, shipToName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter ship to name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Ship To Address
                  </label>
                  <textarea
                    value={Array.isArray(formData.shipToAddress) ? formData.shipToAddress[0] : formData.shipToAddress}
                    onChange={(e) => setFormData({ ...formData, shipToAddress: [e.target.value] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter shipping address"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Place of Supply
                  </label>
                  <input
                    type="text"
                    value={formData.placeOfSupply}
                    onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter place of supply"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                      placeholder="Enter HSN code"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Rate (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                      placeholder="0.00"
                    />
                  </div>

                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleNumber}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                      placeholder="Enter vehicle number"
                    />
                  </div>

                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Weighment Slip Note
                  </label>
                  <textarea
                    value={formData.weighmentSlipNote}
                    onChange={(e) => setFormData({ ...formData, weighmentSlipNote: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4309ac] focus:border-[#4309ac] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter any additional notes"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegenerateForm(false);
                      setSelectedInvoice(null);
                      setError(null);
                      setWeightmentSlip(null);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                    disabled={regenerating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regenerating}
                    className="flex-1 px-4 py-3 bg-[#4309ac] text-white rounded-xl font-medium hover:bg-[#350889] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? 'Updating...' : 'Update & Regenerate PDF'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 bg-black text-white rounded-t-[28px] py-3">
          <div className="relative mx-auto flex max-w-3xl items-end justify-between px-8 text-xs">
            <div
              className="flex flex-col items-center opacity-60 cursor-pointer"
              onClick={() => router.push('/explore')}
            >
              ⬜
              <span>Explore</span>
            </div>

            <div className="ml-auto flex items-end pr-1">
              <div
                className="flex flex-col items-center opacity-60 cursor-pointer"
                onClick={() => router.push('/support')}
              >
                {"\uD83D\uDCAC"}
                <span>Support</span>
              </div>
            </div>

            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center -mt-6">
                👤
              </div>
              <span className="mt-1">Home</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

// User Media Upload Section Component
function UserMediaUploadSection({
    label,
    mediaType,
    existingUrl,
    claimId,
    onUploadClick
}: {
    label: string;
    mediaType: 'fir' | 'accidentPic' | 'lorryReceipt' | 'insurancePolicy';
    existingUrl?: string | null;
    claimId: string;
    onUploadClick: (mediaType: 'fir' | 'accidentPic' | 'lorryReceipt' | 'insurancePolicy') => void;
}) {
    return (
        <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{label}</span>
                {existingUrl && <CheckIcon className="w-5 h-5 text-green-600" />}
            </div>
            <div className="flex items-center gap-2">
                {existingUrl && (
                    <a
                        href={existingUrl}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="View document"
                    >
                        View
                    </a>
                )}
                <button
                    onClick={() => onUploadClick(mediaType)}
                    className={`text-sm px-3 py-1 rounded-lg ${
                        existingUrl
                            ? 'text-green-600 hover:text-green-800 border border-green-600'
                            : 'text-blue-600 hover:text-blue-800 border border-blue-600'
                    }`}
                >
                    {existingUrl ? 'Update' : 'Upload'}
                </button>
            </div>
        </div>
    );
}

export default HomePage;



