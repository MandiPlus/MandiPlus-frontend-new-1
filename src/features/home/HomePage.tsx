"use client";

import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
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
  uploadClaimMedia,
  submitDamageForm,
} from "../insurance/api";
import {
  getMyWalletSummary,
  WalletSummary,
  getCustomerDashboardInvoices,
  getTransporterDashboardInvoices,
  getMyUserInvoices,
  getCustomerDashboardClaims,
  getTransporterDashboardClaims,
  createCustomerWebPaymentCheckout,
} from "../customer/api";
import { getMyChannelPartnerDashboard } from "../channel-partner/api";
import {
  CustomerNotificationBell,
  CustomerWebPushPrompt,
} from "../notifications/CustomerNotificationControls";
import "cropperjs/dist/cropper.css";
import Cropper, { ReactCropperElement } from "react-cropper";
import {
  ArrowPathIcon,
  Bars3Icon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TruckIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { startGatewayCheckout } from "@/features/payments/gateway-checkout";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/";

type CustomerInvoice = InsuranceForm & {
  premiumAmount?: number | string | null;
  paymentAmount?: number | string | null;
  paymentStatus?: string | null;
  paymentLinkUrl?: string | null;
  paymentCompletedAt?: string | null;
  paymentReceiptUrl?: string | null;
  isPaymentRequired?: boolean | null;
  isVerified?: boolean | null;
};

type PaperTab = "pending" | "policy" | "paid" | "all";
type ChannelPartnerProfile = {
  status?: string;
  code?: string;
};

const HomePage = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [channelPartnerProfile, setChannelPartnerProfile] =
    useState<ChannelPartnerProfile | null>(null);

  // Invoice states
  const [invoices, setInvoices] = useState<InsuranceForm[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoiceLoadError, setInvoiceLoadError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InsuranceForm | null>(
    null,
  );
  const [selectedPaperInvoice, setSelectedPaperInvoice] =
    useState<CustomerInvoice | null>(null);
  const [paperTab, setPaperTab] = useState<PaperTab>("pending");
  const [paperSearch, setPaperSearch] = useState("");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  // --- ✅ NEW: Claims States ---
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [statusLookupInput, setStatusLookupInput] = useState("");
  const [statusLookupResult, setStatusLookupResult] =
    useState<ClaimRequest | null>(null);
  const [statusLookupError, setStatusLookupError] = useState<string | null>(
    null,
  );
  const [showClaimInvoiceModal, setShowClaimInvoiceModal] = useState(false);
  const [selectedClaimForInvoice, setSelectedClaimForInvoice] =
    useState<ClaimRequest | null>(null);

  // --- ✅ NEW: Damage Form States ---
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedClaimForDamage, setSelectedClaimForDamage] =
    useState<ClaimRequest | null>(null);
  const [damageFormData, setDamageFormData] = useState<CreateDamageFormDto>({
    damageCertificateDate: new Date().toISOString().split("T")[0],
    transportReceiptMemoNo: "",
    transportReceiptDate: "",
    loadedWeightKg: 0,
    productName: "",
    fromParty: "",
    forParty: "",
    accidentDate: "",
    accidentLocation: "",
    accidentDescription: "",
    agreedDamageAmountNumber: 0,
    agreedDamageAmountWords: "",
    authorizedSignatoryName: "",
  });

  // --- Cropper & File State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeClaimIdForUpload, setActiveClaimIdForUpload] = useState<
    string | null
  >(null); // ✅ NEW
  const [activeMediaType, setActiveMediaType] = useState<
    | "fir"
    | "accidentPic"
    | "lorryReceipt"
    | "insurancePolicy"
    | "damageForm"
    | null
  >(null); // ✅ NEW
  const [showClaimDetailModal, setShowClaimDetailModal] = useState(false); // ✅ NEW
  const [selectedClaimForDetail, setSelectedClaimForDetail] =
    useState<ClaimRequest | null>(null); // ✅ NEW

  const cropperRef = useRef<ReactCropperElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isCropperReady, setIsCropperReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [weightmentSlip, setWeightmentSlip] = useState<File | null>(null);

  // Regenerate form states
  const defaultInvoiceType = (() => {
    const identity = user?.identity?.toUpperCase();
    if (identity === "AGENT" || identity === "SUPPLIER")
      return "SUPPLIER_INVOICE";
    return "BUYER_INVOICE";
  })();
  const [formData, setFormData] = useState<RegenerateInvoicePayload>({
    invoiceId: "",
    supplierName: "",
    supplierAddress: [""],
    placeOfSupply: "",
    billToName: "",
    billToAddress: [""],
    shipToName: "",
    shipToAddress: [""],
    productName: "",
    hsnCode: "",
    quantity: 0,
    rate: 0,
    amount: 0,
    vehicleNumber: "",
    truckNumber: "",
    weighmentSlipNote: "",
    invoiceType: defaultInvoiceType as "BUYER_INVOICE" | "SUPPLIER_INVOICE",
    invoiceDate: new Date().toISOString().split("T")[0],
  });
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isCustomer =
    Boolean(user?.isCustomer) || user?.identity === "CUSTOMER";
  const isTransporter = user?.identity === "TRANSPORTER";
  const isInternalUser =
    user?.identity === "INTERNAL_TEAM" || user?.identity === "FIELD_AGENT";
  const shouldLoadUserDashboard = Boolean(user && !isInternalUser);

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
    } catch {
      setWallet(null);
    }
  };

  useEffect(() => {
    loadWalletData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer]);

  useEffect(() => {
    const checkChannelPartnerStatus = async () => {
      try {
        const data = await getMyChannelPartnerDashboard();
        if (data && data.profile && data.profile.status === "ACTIVE") {
          setChannelPartnerProfile(data.profile);
        }
      } catch (err) {
        console.error("Failed to fetch channel partner profile:", err);
      }
    };
    if (user) {
      checkChannelPartnerStatus();
    }
  }, [user]);

  // Fetch invoices when modal opens
  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    setInvoiceLoadError(null);
    try {
      const data = isCustomer
        ? await getCustomerDashboardInvoices()
        : isTransporter
          ? await getTransporterDashboardInvoices()
          : await getMyUserInvoices();
      setInvoices(data);
    } catch (err: unknown) {
      console.error("Failed to fetch invoices:", err);
      const message = getErrorMessage(err, "Failed to load invoices");
      setInvoiceLoadError(message);
      setError(message);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (!isMounted || !shouldLoadUserDashboard) return;
    fetchInvoices();
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, shouldLoadUserDashboard]);

  const fetchClaimsByRole = async (): Promise<ClaimRequest[]> => {
    if (user?.identity === "INTERNAL_TEAM") {
      return await getAdminClaimsForms();
    }
    if (isCustomer) {
      return await getCustomerDashboardClaims();
    }
    if (isTransporter) {
      return await getTransporterDashboardClaims();
    }
    // Non-internal users remain user-scoped.
    return await getMyClaimsForms();
  };

  const syncClaimInState = (updatedClaim: ClaimRequest) => {
    setClaims((prev) =>
      prev.map((claim) =>
        claim.id === updatedClaim.id ? updatedClaim : claim,
      ),
    );
    setSelectedClaimForDetail((prev) =>
      prev?.id === updatedClaim.id ? updatedClaim : prev,
    );
    setSelectedClaimForDamage((prev) =>
      prev?.id === updatedClaim.id ? updatedClaim : prev,
    );
    setStatusLookupResult((prev) =>
      prev?.id === updatedClaim.id ? updatedClaim : prev,
    );
  };

  const getClaimMediaAccept = (mediaType: typeof activeMediaType) => {
    if (mediaType === "damageForm") return ".pdf,.jpg,.jpeg,.png,.webp,.gif";
    return "image/*,application/pdf,.doc,.docx";
  };

  // --- NEW: Fetch Claims ---
  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const data = await fetchClaimsByRole();
      setClaims(data);
    } catch (err: unknown) {
      console.error("Failed to fetch claims:", err);
      setError(getErrorMessage(err, "Failed to load claims"));
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleOpenInvoiceModal = () => {
    setPaperTab("pending");
    setPaperSearch("");
    setPaymentMessage(null);
    setShowInvoiceModal(true);
    fetchInvoices();
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
    setSelectedPaperInvoice(null);
    setPaymentMessage(null);
  };

  const getInvoiceInsuranceUrl = (invoice: InsuranceForm) => {
    return getInsuranceDocumentUrl(invoice);
  };

  // --- NEW: Open Claims Modal ---
  const handleOpenClaimsModal = () => {
    setShowClaimsModal(true);
    setStatusLookupInput("");
    setStatusLookupResult(null);
    setStatusLookupError(null);
    fetchClaims();
  };

  const handleCheckClaimStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = statusLookupInput.trim().toLowerCase();
    if (!query) {
      setStatusLookupResult(null);
      setStatusLookupError(
        "Please enter claim id, invoice number, or truck number.",
      );
      return;
    }

    const source = claims.length > 0 ? claims : await fetchClaimsByRole();
    if (claims.length === 0) {
      setClaims(source);
    }

    const matched = source.find((claim) => {
      const claimId = String(claim.id || "").toLowerCase();
      const invoiceNo = String(
        claim.invoice?.invoiceNumber || "",
      ).toLowerCase();
      const vehicleNo = String(
        claim.invoice?.vehicleNumber || "",
      ).toLowerCase();
      const truckNo = String(claim.invoice?.truckNumber || "").toLowerCase();
      return (
        claimId.includes(query) ||
        invoiceNo.includes(query) ||
        vehicleNo.includes(query) ||
        truckNo.includes(query)
      );
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
  const handleClaimMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (
      e.target.files &&
      e.target.files.length > 0 &&
      activeClaimIdForUpload &&
      activeMediaType
    ) {
      try {
        const file = e.target.files[0];
        if (
          activeMediaType === "damageForm" &&
          !/^(image\/|application\/pdf$)/i.test(file.type)
        ) {
          alert("Damage certificate only supports PDF and image files.");
          return;
        }
        const updatedClaim = await uploadClaimMedia(
          activeClaimIdForUpload,
          activeMediaType,
          file,
        );
        alert("File uploaded successfully!");
        syncClaimInState(updatedClaim);
      } catch (err: unknown) {
        console.error("Upload failed:", err);
        const msg = getErrorMessage(err, "Failed to upload file.");
        alert(`Upload Failed: ${msg}`);
      } finally {
        setActiveClaimIdForUpload(null);
        setActiveMediaType(null);
        e.target.value = "";
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
    if (claim.damageFormUrl || claim.claimFormUrl) {
      window.open(claim.damageFormUrl || claim.claimFormUrl, "_blank");
      return;
    }
    setSelectedClaimForDamage(claim);
    setDamageFormData({
      damageCertificateDate: new Date().toISOString().split("T")[0],
      transportReceiptMemoNo: claim.invoice?.invoiceNumber || "",
      transportReceiptDate: claim.invoice?.createdAt
        ? new Date(claim.invoice.createdAt).toISOString().split("T")[0]
        : "",
      loadedWeightKg: claim.invoice?.quantity || 0,
      productName: claim.invoice?.productName?.[0] || "",
      fromParty: claim.invoice?.supplierName || "",
      forParty: claim.invoice?.billToName || "",
      accidentDate: "",
      accidentLocation: "",
      accidentDescription: "",
      agreedDamageAmountNumber: 0,
      agreedDamageAmountWords: "",
      authorizedSignatoryName: "",
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
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Failed to submit damage form");
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const rotateImage = (degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360);
    cropperRef.current?.cropper.rotateTo(rotation + degrees);
  };

  const handleCropComplete = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper
      .getCroppedCanvas({
        minWidth: 300,
        minHeight: 300,
        maxWidth: 4096,
        maxHeight: 4096,
        fillColor: "#fff",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      })
      .toBlob(
        (blob) => {
          if (blob) {
            setWeightmentSlip(
              new File([blob], "updated-weightment-slip.jpg", {
                type: "image/jpeg",
              }),
            );
            setIsCropping(false);
            setImageSrc(null);
          }
        },
        "image/jpeg",
        0.9,
      );
  };

  const handleEditInvoice = (invoice: InsuranceForm) => {
    setSelectedInvoice(invoice);
    setWeightmentSlip(null); // Reset file
    setFormData({
      invoiceId: invoice.id,
      supplierName: invoice.supplierName,
      supplierAddress: invoice.supplierAddress || [""],
      placeOfSupply: invoice.placeOfSupply,
      billToName: invoice.billToName,
      billToAddress: invoice.billToAddress || [""],
      shipToName: invoice.shipToName || "",
      shipToAddress: invoice.shipToAddress || [""],
      productName: Array.isArray(invoice.productName)
        ? invoice.productName[0] || ""
        : invoice.productName || "",
      hsnCode: invoice.hsnCode || "",
      quantity: invoice.quantity || 0,
      rate: invoice.rate || 0,
      amount: invoice.amount || 0,
      vehicleNumber: invoice.vehicleNumber || "",
      truckNumber: invoice.truckNumber || "",
      weighmentSlipNote: invoice.weighmentSlipNote || "",
      invoiceType: defaultInvoiceType as "BUYER_INVOICE" | "SUPPLIER_INVOICE",
      invoiceDate: invoice.createdAt
        ? new Date(invoice.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
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
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for PDF generation
      }

      // 2. Prepare FormData
      const payload = new FormData();
      const append = (key: string, value: unknown) =>
        payload.append(key, String(value ?? ""));

      append("invoiceType", formData.invoiceType);
      append("invoiceDate", formData.invoiceDate);
      append("supplierName", formData.supplierName);
      append("placeOfSupply", formData.placeOfSupply);
      append("billToName", formData.billToName);
      append("shipToName", formData.shipToName);
      append("hsnCode", formData.hsnCode);
      append("vehicleNumber", formData.vehicleNumber);
      append("truckNumber", formData.truckNumber);
      append("weighmentSlipNote", formData.weighmentSlipNote);
      append("productName", formData.productName);
      append("quantity", formData.quantity);
      append("rate", formData.rate);
      append(
        "amount",
        (Number(formData.quantity) || 0) * (Number(formData.rate) || 0),
      );

      const processArray = (key: string, arr: unknown) => {
        const valid = Array.isArray(arr)
          ? arr.filter((x) => typeof x === "string")
          : [String(arr || "")];
        valid.forEach((v) => payload.append(key, v));
      };
      processArray("supplierAddress", formData.supplierAddress);
      processArray("billToAddress", formData.billToAddress);
      processArray("shipToAddress", formData.shipToAddress);

      // 3. Update Text
      await updateInvoice(selectedInvoice.id, payload);

      // 4. Final Wait & Refresh
      const fresh =
        isCustomer
          ? await getCustomerDashboardInvoices()
          : await getMyInsuranceForms();
      setInvoices(fresh);

      alert("Invoice updated successfully!");
      setShowRegenerateForm(false);
      setSelectedInvoice(null);
      setWeightmentSlip(null);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Failed to regenerate invoice");
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

  const customerInvoices = shouldLoadUserDashboard
    ? (invoices as CustomerInvoice[])
    : [];
  const pendingPaymentInvoices = customerInvoices.filter(
    isPayableCustomerInvoice,
  );
  const checkoutPaymentInvoices = pendingPaymentInvoices.filter((invoice) =>
    Boolean(invoice.isVerified),
  );
  const awaitingApprovalInvoices = pendingPaymentInvoices.filter(
    (invoice) => !invoice.isVerified,
  );
  const paidCustomerInvoices = customerInvoices.filter((invoice) =>
    isPaidCustomerInvoice(invoice),
  );
  const policyInvoices = customerInvoices.filter((invoice) =>
    Boolean(getInvoiceInsuranceUrl(invoice)),
  );
  const pendingDueTotal = checkoutPaymentInvoices.reduce(
    (sum, invoice) => sum + getInvoicePayableAmount(invoice),
    0,
  );
  const activeClaimsCount = claims.filter(
    (claim) => !isClosedClaimStatus(claim.status),
  ).length;
  const recentPapers = [
    ...pendingPaymentInvoices.slice(0, 2),
    ...policyInvoices
      .filter(
        (invoice) =>
          !pendingPaymentInvoices.some((item) => item.id === invoice.id),
      )
      .slice(0, 2),
  ].slice(0, 3);

  const tabInvoices =
    paperTab === "pending"
      ? pendingPaymentInvoices
      : paperTab === "policy"
        ? policyInvoices
        : paperTab === "paid"
          ? paidCustomerInvoices
          : customerInvoices;

  const paperRows = tabInvoices.filter((invoice) => {
    const query = paperSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      invoice.invoiceNumber,
      getInvoiceVehicle(invoice),
      getInvoiceProduct(invoice),
      invoice.supplierName,
      invoice.billToName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const activePaperInvoice =
    selectedPaperInvoice &&
    paperRows.some((invoice) => invoice.id === selectedPaperInvoice.id)
      ? selectedPaperInvoice
      : paperRows[0] || null;

  const openPapers = (tab: PaperTab = "all") => {
    router.push(`/my-insurance-forms?tab=${tab}`);
  };

  const startPendingPaymentCheckout = async (invoiceIds?: string[]) => {
    if (creatingCheckout || loadingInvoices || invoiceLoadError) return;
    setPaymentMessage(null);
    const selectedInvoices = invoiceIds?.length
      ? checkoutPaymentInvoices.filter((invoice) =>
          invoiceIds.includes(invoice.id),
        )
      : checkoutPaymentInvoices;
    if (selectedInvoices.length === 0) {
      if (awaitingApprovalInvoices.length > 0) {
        setPaymentMessage(
          `${awaitingApprovalInvoices.length} invoice${awaitingApprovalInvoices.length > 1 ? "s are" : " is"} awaiting approval. Payment will be available after verification.`,
        );
        return;
      }
      openPapers("all");
      return;
    }

    setCreatingCheckout(true);
    try {
      const checkout = await createCustomerWebPaymentCheckout(
        selectedInvoices.map((invoice) => invoice.id),
      );
      await startGatewayCheckout(checkout);
    } catch (err: unknown) {
      setPaymentMessage(
        getErrorMessage(
          err,
          "Could not start PhonePe checkout. Please try again.",
        ),
      );
    } finally {
      setCreatingCheckout(false);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <ProtectedRoute
      allowedIdentities={[
        "BUYER",
        "SUPPLIER",
        "CUSTOMER",
        "INTERNAL_TEAM",
        "FIELD_AGENT",
      ]}
    >
      <div className="min-h-screen bg-[#f5f6fb] pb-28 text-[#171914]">
        {/* --- NEW: Cropper Overlay --- */}
        {isCropping && imageSrc && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="flex-1 w-full relative min-h-0 bg-black">
              <Cropper
                src={imageSrc}
                style={{ height: "100%", width: "100%" }}
                ref={cropperRef}
                guides={true}
                viewMode={1}
                dragMode="move"
                autoCropArea={1}
                checkOrientation={true}
                ready={() => {
                  setIsCropperReady(true);
                  setRotation(0);
                }}
              />
            </div>
            <div className="w-full bg-black/90 p-4 flex justify-between items-center px-6 z-50 border-t border-gray-800">
              <div className="flex gap-4 text-white">
                <button type="button" onClick={() => rotateImage(-90)}>
                  <ArrowPathIcon className="w-6 h-6 transform rotate-90" />
                </button>
                <button type="button" onClick={() => rotateImage(90)}>
                  <ArrowPathIcon className="w-6 h-6 -scale-x-100 transform rotate-90" />
                </button>
              </div>
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsCropping(false);
                    setImageSrc(null);
                  }}
                  className="text-red-500"
                >
                  <XMarkIcon className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={handleCropComplete}
                  disabled={!isCropperReady}
                  className={
                    isCropperReady ? "text-[#25D366]" : "text-gray-500"
                  }
                >
                  <CheckIcon className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="relative border-b border-[#e7ebf3] bg-white px-5 py-4 text-black">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center bg-white px-2 py-1 rounded-2xl -ml-2">
              <h2
                className="text-2xl font-bold tracking-tight -ml-10"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                <span className="text-slate-800">Mandi</span>
                <span className="text-[#203044]">Plus</span>
              </h2>
              <p className="text-xs font-medium">
                <span className="text-black">Risk Humara, </span>
                <span className="text-[#203044]">Munafa Aapka</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isInternalUser ? (
                <CustomerNotificationBell mobile={user?.mobileNumber} />
              ) : null}
              <div className="hidden md:flex flex-col items-end rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] px-3 py-2 text-right leading-tight">
                <p className="text-xs font-semibold tracking-wide text-[#203044]">
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
                  className="rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] px-3 py-2 text-right"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#203044]">
                    Wallet
                  </p>
                  <p className="text-xs font-bold text-slate-900">
                    {formatCurrency(wallet?.availableBalance ?? 0)}
                  </p>
                </button>
              )}
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
                className="rounded-2xl border border-[#e7ebf3] bg-white p-2.5 text-[#203044] transition-all duration-200 active:scale-95"
              >
                <Bars3Icon className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>
          </div>

          {!isInternalUser ? (
            <CustomerWebPushPrompt mobile={user?.mobileNumber} />
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2 md:hidden">
            <div className="min-w-0 rounded-full border border-[#e7ebf3] bg-[#f8f9fd] px-3 py-1.5">
              <p className="truncate text-[11px] font-semibold text-[#203044]">
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
                  className="p-2 rounded-xl text-slate-600 hover:bg-[#f5f6fb] hover:text-[#203044] transition-colors duration-200"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex flex-col py-2">
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center"
                >
                  Pricing
                </Link>
                <Link
                  href="/refund-policy"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center"
                >
                  Refund Policy
                </Link>
                <Link
                  href="/privacy-policy"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center"
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
                    className="px-5 py-3.5 text-left text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center"
                  >
                    Wallet
                  </button>
                )}
                <Link
                  href="/terms-and-conditions"
                  onClick={() => setMenuOpen(false)}
                  className="px-5 py-3.5 text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center"
                >
                  Terms &amp; Conditions
                </Link>

                {channelPartnerProfile && (
                  <a
                    href="/channel-partner/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="px-5 py-3.5 text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center gap-2 font-medium"
                  >
                    <span>Partner Portal</span>
                    <span className="text-[10px] bg-[#203044] text-white px-2 py-0.5 rounded-full font-semibold">
                      Active
                    </span>
                    <svg
                      className="w-4 h-4 ml-auto text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}

                <div className="border-t border-slate-100 my-2" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="px-5 py-3.5 text-left text-slate-800 hover:bg-[#f5f6fb]/50 hover:text-[#203044] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>

        {channelPartnerProfile && (
          <div className="px-5 mt-5">
            <div
              className="bg-white border border-[#f5f6fb] rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex items-center justify-between gap-4 group"
              onClick={() =>
                window.open("/channel-partner/dashboard", "_blank")
              }
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-800 group-hover:underline">
                    Partner Portal
                  </h3>
                  <span className="text-[10px] font-semibold text-[#203044] bg-[#f8f9fd] px-2 py-0.5 rounded-full border border-[#e7ebf3]">
                    Code: {channelPartnerProfile.code}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate sm:whitespace-normal">
                  Manage your onboarded customers, check analytics, and view
                  commissions.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 bg-[#203044] hover:bg-[#171914] text-white text-xs font-semibold px-4 py-2 rounded-2xl flex items-center gap-1.5 transition-all shadow-sm group-hover:shadow group-hover:scale-[1.02] active:scale-95"
              >
                <span>Dashboard</span>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
          {shouldLoadUserDashboard ? (
            <section className="rounded-[24px] border border-[#e7ebf3] bg-white p-5 shadow-[0_10px_24px_rgba(32,48,68,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#203044]">
                    {loadingInvoices
                      ? "Checking payments"
                      : invoiceLoadError
                        ? "Payments unavailable"
                        : checkoutPaymentInvoices.length
                          ? "Payment due"
                          : awaitingApprovalInvoices.length
                            ? "Awaiting approval"
                            : "All clear"}
                  </p>
                  {loadingInvoices ? (
                    <div
                      className="mt-3 h-9 w-44 animate-pulse rounded-lg bg-[#e9edf4]"
                      aria-label="Loading payment dues"
                    />
                  ) : invoiceLoadError ? (
                    <h1 className="mt-2 text-4xl font-black leading-none tracking-normal text-[#171914]">
                      --
                    </h1>
                  ) : (
                    <h1 className="mt-2 text-4xl font-black leading-none tracking-normal text-[#171914]">
                      {checkoutPaymentInvoices.length
                        ? formatCurrency(pendingDueTotal)
                        : "No dues"}
                    </h1>
                  )}
                  <p className="mt-2 text-sm font-semibold text-[#7b8176]">
                    {loadingInvoices
                      ? "Loading your latest invoices..."
                      : invoiceLoadError
                        ? "We could not load your latest dues. Please retry."
                        : checkoutPaymentInvoices.length
                          ? `${checkoutPaymentInvoices.length} invoice${checkoutPaymentInvoices.length > 1 ? "s" : ""} ready to pay`
                          : awaitingApprovalInvoices.length
                            ? `${awaitingApprovalInvoices.length} invoice${awaitingApprovalInvoices.length > 1 ? "s" : ""} will appear here after approval`
                            : "Your payments are clear right now"}
                  </p>
                  {!loadingInvoices &&
                  checkoutPaymentInvoices.length > 0 &&
                  awaitingApprovalInvoices.length > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-[#95601b]">
                      {awaitingApprovalInvoices.length} more awaiting approval
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={
                    invoiceLoadError
                      ? fetchInvoices
                      : () => startPendingPaymentCheckout()
                  }
                  disabled={creatingCheckout || loadingInvoices}
                  className="min-h-12 shrink-0 rounded-full bg-[#203044] px-5 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingInvoices
                    ? "Checking..."
                    : invoiceLoadError
                      ? "Retry"
                      : creatingCheckout
                        ? "Opening PhonePe..."
                        : checkoutPaymentInvoices.length
                          ? "Pay Now"
                          : "Papers"}
                </button>
              </div>
              {paymentMessage ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-[#f2d7d2] bg-[#fff7f5] px-4 py-3 text-sm font-semibold text-[#a63f35]"
                >
                  {paymentMessage}
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-xl font-black text-[#171914]">Quick Tap</h2>
              {loadingInvoices && isCustomer ? (
                <span className="text-xs font-semibold text-[#7b8176]">
                  Updating...
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HomeActionCard
                icon={<CreditCardIcon className="h-6 w-6" />}
                title="Pay Due"
                detail={
                  loadingInvoices
                    ? "Loading..."
                    : invoiceLoadError
                      ? "Unavailable"
                      : checkoutPaymentInvoices.length
                        ? `${checkoutPaymentInvoices.length} ready`
                        : awaitingApprovalInvoices.length
                          ? "Awaiting approval"
                          : "No dues"
                }
                onClick={
                  invoiceLoadError
                    ? fetchInvoices
                    : () => startPendingPaymentCheckout()
                }
                tone="blue"
              />
              <HomeActionCard
                icon={<TruckIcon className="h-6 w-6" />}
                title="Track Truck"
                detail="Live status"
                onClick={() => router.push("/tracking")}
                tone="green"
              />
              <HomeActionCard
                icon={<ShieldCheckIcon className="h-6 w-6" />}
                title="See Policy"
                detail={
                  policyInvoices.length
                    ? `${policyInvoices.length} ready`
                    : "My papers"
                }
                onClick={() => openPapers("policy")}
                tone="purple"
              />
              <HomeActionCard
                icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
                title="My Claims"
                detail={
                  activeClaimsCount
                    ? `${activeClaimsCount} active`
                    : "View status"
                }
                onClick={handleOpenClaimsModal}
                tone="orange"
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#e7ebf3] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#171914]">
                  My Papers
                </h3>
                <p className="text-xs font-semibold text-[#7b8176]">
                  Invoices and policy PDFs
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPapers("all")}
                className="min-h-10 rounded-full border border-[#d7deea] px-4 text-xs font-black text-[#203044]"
              >
                See all
              </button>
            </div>

            {recentPapers.length ? (
              <div className="space-y-2">
                {recentPapers.map((invoice) => {
                  const payable = isPayableCustomerInvoice(invoice);
                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => {
                        router.push(
                          `/my-insurance-forms?tab=${payable ? "pending" : getInvoiceInsuranceUrl(invoice) ? "policy" : "all"}`,
                        );
                      }}
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] px-3 py-2 text-left transition active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#203044]">
                        <DocumentTextIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#171914]">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="truncate text-xs font-semibold text-[#7b8176]">
                          {getInvoiceVehicle(invoice)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black ${payable ? "bg-[#fff1d8] text-[#95601b]" : "bg-[#eef3fa] text-[#203044]"}`}
                      >
                        {payable
                          ? "Due"
                          : getInvoiceInsuranceUrl(invoice)
                            ? "Policy"
                            : "View"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d7deea] bg-[#f8f9fd] px-4 py-5 text-sm font-semibold text-[#7b8176]">
                Papers will appear here after invoice creation.
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/insurance")}
              className="min-h-[58px] rounded-2xl border border-[#e7ebf3] bg-white px-4 text-left text-sm font-black text-[#171914]"
            >
              Create Policy
              <span className="mt-1 block text-xs font-semibold text-[#7b8176]">
                New invoice
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/know-your-vehicle")}
              className="min-h-[58px] rounded-2xl border border-[#e7ebf3] bg-white px-4 text-left text-sm font-black text-[#171914]"
            >
              Vehicle Info
              <span className="mt-1 block text-xs font-semibold text-[#7b8176]">
                Check details
              </span>
            </button>
          </section>
        </main>

        {/* PAPERS MODAL */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
              <div className="sticky top-0 z-10 border-b border-[#e7ebf3] bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-[#171914]">
                      My Papers
                    </h3>
                    <p className="text-xs font-semibold text-[#7b8176]">
                      Invoices and insurance policy PDFs
                    </p>
                  </div>
                  <button
                    onClick={closeInvoiceModal}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7ebf3] text-[#203044]"
                    aria-label="Close papers"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {(
                    [
                      ["pending", `Pending ${pendingPaymentInvoices.length}`],
                      ["policy", `Policy ${policyInvoices.length}`],
                      ["paid", `Paid ${paidCustomerInvoices.length}`],
                      [
                        "all",
                        `All ${customerInvoices.length || invoices.length}`,
                      ],
                    ] as [PaperTab, string][]
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setPaperTab(tab);
                        setSelectedPaperInvoice(null);
                        setPaymentMessage(null);
                      }}
                      className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black transition ${
                        paperTab === tab
                          ? "bg-[#203044] text-white"
                          : "border border-[#e7ebf3] bg-[#f8f9fd] text-[#203044]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid max-h-[calc(92vh-132px)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="border-[#e7ebf3] p-4 lg:border-r">
                  <div className="mb-3 flex min-h-11 items-center gap-2 rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] px-3">
                    <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-[#7b8176]" />
                    <input
                      value={paperSearch}
                      onChange={(event) => setPaperSearch(event.target.value)}
                      placeholder="Search invoice or truck"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#171914] outline-none placeholder:text-[#7b8176]"
                    />
                  </div>

                  {paymentMessage ? (
                    <div className="mb-3 rounded-2xl border border-[#fff1d8] bg-[#fff8eb] px-4 py-3 text-sm font-semibold text-[#95601b]">
                      {paymentMessage}
                    </div>
                  ) : null}

                  {loadingInvoices ? (
                    <div className="rounded-2xl border border-dashed border-[#d7deea] bg-[#f8f9fd] px-4 py-8 text-center text-sm font-semibold text-[#7b8176]">
                      Loading papers...
                    </div>
                  ) : paperRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#d7deea] bg-[#f8f9fd] px-4 py-8 text-center text-sm font-semibold text-[#7b8176]">
                      No papers found here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paperRows.map((invoice) => {
                        const isRejected = Boolean(invoice.isRejected);
                        const payable = isPayableCustomerInvoice(invoice);
                        const insuranceUrl = getInvoiceInsuranceUrl(invoice);
                        const active = activePaperInvoice?.id === invoice.id;
                        return (
                          <button
                            key={invoice.id}
                            type="button"
                            onClick={() => {
                              setSelectedPaperInvoice(invoice);
                              setPaymentMessage(null);
                            }}
                            className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-[#b9c6da] bg-[#eef3fa]"
                                : isRejected
                                  ? "border-[#ffe7e0] bg-[#fff7f5]"
                                  : "border-[#e7ebf3] bg-white active:scale-[0.99]"
                            }`}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8f9fd] text-[#203044]">
                              <DocumentTextIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-black text-[#171914]">
                                  {invoice.invoiceNumber}
                                </p>
                                {isRejected && (
                                  <span className="rounded-full bg-[#ffe7e0] px-2 py-0.5 text-[10px] font-black text-[#c84f45]">
                                    Rejected
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs font-semibold text-[#7b8176]">
                                {getInvoiceVehicle(invoice)} ·{" "}
                                {getInvoiceProduct(invoice)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-[#171914]">
                                {formatCurrency(
                                  payable
                                    ? getInvoicePayableAmount(invoice)
                                    : getNumericAmount(invoice.amount),
                                )}
                              </p>
                              <p
                                className={`mt-1 text-[11px] font-black ${payable ? "text-[#95601b]" : insuranceUrl ? "text-[#203044]" : "text-[#7b8176]"}`}
                              >
                                {payable
                                  ? "Due"
                                  : insuranceUrl
                                    ? "Policy"
                                    : formatPaymentStatus(
                                        invoice.paymentStatus,
                                      )}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <aside className="bg-[#f8f9fd] p-4">
                  {activePaperInvoice ? (
                    <div className="rounded-[22px] border border-[#e7ebf3] bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7b8176]">
                        Selected paper
                      </p>
                      <h4 className="mt-2 text-xl font-black text-[#171914]">
                        {activePaperInvoice.invoiceNumber}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-[#7b8176]">
                        {getInvoiceVehicle(activePaperInvoice)}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <PaperMiniStat
                          label="Amount"
                          value={formatCurrency(
                            getNumericAmount(activePaperInvoice.amount),
                          )}
                        />
                        <PaperMiniStat
                          label="Payable"
                          value={formatCurrency(
                            getInvoicePayableAmount(activePaperInvoice),
                          )}
                        />
                      </div>

                      {activePaperInvoice.isRejected &&
                      activePaperInvoice.rejectionReason ? (
                        <div className="mt-3 rounded-2xl bg-[#ffe7e0] px-3 py-2 text-xs font-semibold text-[#c84f45]">
                          {activePaperInvoice.rejectionReason}
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-2">
                        {isPayableCustomerInvoice(activePaperInvoice) ? (
                          <button
                            type="button"
                            onClick={() =>
                              startPendingPaymentCheckout([
                                activePaperInvoice.id,
                              ])
                            }
                            disabled={creatingCheckout}
                            className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#203044] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {creatingCheckout
                              ? "Opening..."
                              : `Pay ${formatCurrency(getInvoicePayableAmount(activePaperInvoice))}`}
                          </button>
                        ) : null}

                        {getInvoicePdfUrl(activePaperInvoice) ? (
                          <a
                            href={`${getInvoicePdfUrl(activePaperInvoice)}?t=${Date.now()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[#d7deea] bg-white px-4 text-sm font-black text-[#203044]"
                          >
                            Invoice PDF
                          </a>
                        ) : null}

                        {getInvoiceInsuranceUrl(activePaperInvoice) ? (
                          <a
                            href={`${getInvoiceInsuranceUrl(activePaperInvoice)}?t=${Date.now()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[#d7deea] bg-white px-4 text-sm font-black text-[#203044]"
                          >
                            Policy PDF
                          </a>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#d7deea] px-3 py-3 text-center text-xs font-semibold text-[#7b8176]">
                            Policy not ready yet
                          </div>
                        )}

                        {!activePaperInvoice.isRejected ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleEditInvoice(activePaperInvoice)
                            }
                            className="min-h-11 w-full rounded-full border border-[#d7deea] bg-[#f8f9fd] px-4 text-sm font-black text-[#203044]"
                          >
                            Edit Details
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-[#d7deea] bg-white px-4 py-8 text-center text-sm font-semibold text-[#7b8176]">
                      Select an invoice to view its papers.
                    </div>
                  )}
                </aside>
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
                <button
                  onClick={() => setShowClaimsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-2">
                    Check Claim Status
                  </h4>
                  <form
                    onSubmit={handleCheckClaimStatus}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Enter Claim ID / Invoice No / Truck No"
                      value={statusLookupInput}
                      onChange={(e) => setStatusLookupInput(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#203044] text-black"
                    />
                    <button
                      type="submit"
                      className="bg-[#203044] text-white px-4 py-2 rounded-xl font-medium"
                    >
                      Check
                    </button>
                  </form>

                  {statusLookupError && (
                    <p className="text-xs text-rose-700 mt-2">
                      {statusLookupError}
                    </p>
                  )}

                  {statusLookupResult && (
                    <div className="mt-3 rounded-xl bg-white border border-gray-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">
                          {statusLookupResult.invoice?.invoiceNumber ||
                            statusLookupResult.id}
                        </p>
                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                            statusLookupResult.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : statusLookupResult.status === "inprogress" ||
                                  statusLookupResult.status ===
                                    "surveyor_assigned"
                                ? "bg-blue-100 text-blue-800"
                                : statusLookupResult.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {statusLookupResult.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Created:{" "}
                        {new Date(
                          statusLookupResult.createdAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Claims List */}
                {loadingClaims ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading claims...
                  </div>
                ) : claims.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No claims found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="border rounded-2xl p-4 hover:shadow-md transition-shadow relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span
                              className={`inline-block px-2 py-1 rounded-lg text-xs font-bold mb-1 ${
                                claim.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : claim.status === "inprogress" ||
                                      claim.status === "surveyor_assigned"
                                    ? "bg-blue-100 text-blue-800"
                                    : claim.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {claim.status.replace("_", " ")}
                            </span>
                            <h4 className="font-semibold text-slate-800">
                              {claim.invoice?.invoiceNumber || "Invoice N/A"}
                            </h4>
                            <p className="text-xs text-gray-500">
                              Created:{" "}
                              {new Date(claim.createdAt).toLocaleDateString()}
                            </p>
                            {claim.surveyorName && (
                              <p className="text-xs text-[#203044] mt-1">
                                Surveyor: {claim.surveyorName} (
                                {claim.surveyorContact})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={() => openClaimDetailModal(claim)}
                            className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-medium hover:bg-blue-100 border border-blue-100 flex items-center gap-1"
                          >
                            Submit Documents
                          </button>

                          <button
                            onClick={() => openClaimInvoiceModal(claim)}
                            className="bg-gray-50 text-gray-700 px-3 py-2 rounded-xl text-xs font-medium hover:bg-gray-100 border border-gray-200 flex items-center gap-1"
                          >
                            Invoice
                          </button>

                          {claim.claimFormUrl && (
                            <a
                              href={claim.claimFormUrl}
                              target="_blank"
                              className="bg-[#f8f9fd] text-[#203044] px-3 py-2 rounded-xl text-xs font-medium border border-[#e7ebf3]"
                            >
                              View Cert
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
              accept={getClaimMediaAccept(activeMediaType)}
            />
          </div>
        )}

        {/* NEW: CLAIM INVOICE MODAL (for My Claims list) */}
        {showClaimInvoiceModal && selectedClaimForInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-3xl">
                <h3 className="text-xl font-bold text-slate-800">
                  Invoice Details
                </h3>
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
                      {selectedClaimForInvoice.invoice?.invoiceNumber || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Invoice Date</div>
                    <div>
                      {selectedClaimForInvoice.invoice?.createdAt
                        ? new Date(
                            selectedClaimForInvoice.invoice.createdAt,
                          ).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Supplier</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.invoice?.supplierName || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Buyer</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.invoice?.billToName || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Truck Number</div>
                    <div>
                      {selectedClaimForInvoice.invoice?.vehicleNumber || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Quantity</div>
                    <div>
                      {selectedClaimForInvoice.invoice?.quantity ?? "N/A"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div>
                      ₹ {selectedClaimForInvoice.invoice?.amount ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="font-medium">
                      {selectedClaimForInvoice.status.replace("_", " ")}
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
                      Open Invoice PDF
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
                <h3 className="text-xl font-bold text-slate-800">
                  Claim Documents
                </h3>
                <button
                  onClick={() => setShowClaimDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {/* Claim Info */}
                <div className="mb-6 p-4 bg-[#f8f9fd] rounded-2xl">
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-semibold">Invoice:</span>{" "}
                      {selectedClaimForDetail.invoice?.invoiceNumber || "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold">Truck:</span>{" "}
                      {selectedClaimForDetail.invoice?.vehicleNumber || "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>
                      <span
                        className={`ml-2 inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                          selectedClaimForDetail.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : selectedClaimForDetail.status === "inprogress" ||
                                selectedClaimForDetail.status ===
                                  "surveyor_assigned"
                              ? "bg-blue-100 text-blue-800"
                              : selectedClaimForDetail.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedClaimForDetail.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Media Upload Sections */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Documents & Media
                  </h4>

                  {/* 1. Accident Picture */}
                  <UserMediaUploadSection
                    label="Accident Picture"
                    mediaType="accidentPic"
                    existingUrl={selectedClaimForDetail.accidentPic}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById("claim-media-upload")?.click();
                    }}
                  />

                  {/* 2. Damage Certificate */}
                  <UserMediaUploadSection
                    label="Damage Certificate"
                    mediaType="damageForm"
                    existingUrl={
                      selectedClaimForDetail.damageFormUrl ||
                      selectedClaimForDetail.claimFormUrl
                    }
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById("claim-media-upload")?.click();
                    }}
                  />
                  {false && (
                    <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          Damage Certificate
                        </span>
                        <span className="text-xs text-gray-500">
                          (Filled by your transporter)
                        </span>
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
                  )}

                  {/* 3. FIR Document */}
                  <UserMediaUploadSection
                    label="FIR Document"
                    mediaType="fir"
                    existingUrl={selectedClaimForDetail.fir}
                    claimId={selectedClaimForDetail.id}
                    onUploadClick={(mediaType) => {
                      setActiveClaimIdForUpload(selectedClaimForDetail.id);
                      setActiveMediaType(mediaType);
                      document.getElementById("claim-media-upload")?.click();
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
                      document.getElementById("claim-media-upload")?.click();
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
                      document.getElementById("claim-media-upload")?.click();
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
                <h3 className="text-xl font-bold text-slate-800">
                  Update Invoice
                </h3>
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
                  <label className="block text-sm font-medium text-slate-800 mb-2">
                    Upload Weighment Slip
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex flex-col gap-3">
                    {weightmentSlip ? (
                      <div className="text-green-700 text-sm bg-green-50 p-2 rounded">
                        {weightmentSlip.name}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center">
                        No new slip selected
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      📸 {weightmentSlip ? "Replace Photo" : "Upload New Photo"}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  Invoice:{" "}
                  <span className="font-semibold">
                    {selectedInvoice.invoiceNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">
                      Invoice Type
                    </label>
                    <select
                      value={formData.invoiceType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoiceType: e.target
                            .value as RegenerateInvoicePayload["invoiceType"],
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    onChange={(e) =>
                      setFormData({ ...formData, supplierName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Supplier Address
                  </label>
                  <textarea
                    value={
                      Array.isArray(formData.supplierAddress)
                        ? formData.supplierAddress[0]
                        : formData.supplierAddress
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        supplierAddress: [e.target.value],
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    onChange={(e) =>
                      setFormData({ ...formData, billToName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter buyer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Bill To Address
                  </label>
                  <textarea
                    value={
                      Array.isArray(formData.billToAddress)
                        ? formData.billToAddress[0]
                        : formData.billToAddress
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billToAddress: [e.target.value],
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    onChange={(e) =>
                      setFormData({ ...formData, shipToName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
                    placeholder="Enter ship to name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Ship To Address
                  </label>
                  <textarea
                    value={
                      Array.isArray(formData.shipToAddress)
                        ? formData.shipToAddress[0]
                        : formData.shipToAddress
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shipToAddress: [e.target.value],
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        placeOfSupply: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          productName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                      onChange={(e) =>
                        setFormData({ ...formData, hsnCode: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vehicleNumber: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weighmentSlipNote: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#203044] focus:border-[#203044] focus:outline-none text-slate-800 placeholder-gray-400 bg-white"
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
                    className="flex-1 px-4 py-3 bg-[#203044] text-white rounded-xl font-medium hover:bg-[#171914] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? "Updating..." : "Update & Regenerate PDF"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 rounded-t-[28px] bg-[#171914] py-3 text-white">
          <div className="relative mx-auto flex max-w-3xl items-end justify-between px-8 text-xs">
            <button
              type="button"
              className="flex flex-col items-center gap-1 opacity-70"
              onClick={() => router.push("/explore")}
            >
              <Squares2X2Icon className="h-5 w-5" />
              <span>Explore</span>
            </button>

            <div className="ml-auto flex items-end pr-1">
              <button
                type="button"
                className="flex flex-col items-center gap-1 opacity-70"
                onClick={() => router.push("/support")}
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                <span>Support</span>
              </button>
            </div>

            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex flex-col items-center">
              <div className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#171914]">
                <HomeIcon className="h-6 w-6" />
              </div>
              <span className="mt-1">Home</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

function HomeActionCard({
  icon,
  title,
  detail,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone: "blue" | "green" | "purple" | "orange";
  onClick: () => void;
}) {
  const toneClass =
    tone === "orange"
      ? "bg-[#fff1d8] text-[#95601b]"
      : tone === "blue"
        ? "bg-[#e4f1f6] text-[#203044]"
        : tone === "green"
          ? "bg-[#eef3fa] text-[#203044]"
          : "bg-[#f8f9fd] text-[#203044]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[104px] rounded-[20px] border border-[#e7ebf3] bg-white p-4 text-left transition active:scale-[0.99]"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}
      >
        {icon}
      </span>
      <span className="mt-3 block text-base font-black leading-5 text-[#171914]">
        {title}
      </span>
      <span className="mt-1 block text-xs font-semibold text-[#7b8176]">
        {detail}
      </span>
    </button>
  );
}

function PaperMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f8f9fd] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#7b8176]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-[#171914]">{value}</p>
    </div>
  );
}

function getNumericAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getInvoicePayableAmount(invoice: CustomerInvoice) {
  const status = String(invoice.paymentStatus || "").toUpperCase();
  const premium = getNumericAmount(invoice.premiumAmount);
  const recordedPayment = getNumericAmount(invoice.paymentAmount);

  if (status === "PARTIAL" && premium > 0) {
    return Math.max(premium - recordedPayment, 0);
  }

  // paymentAmount is stored as the amount already paid by accounting flows.
  // A decimal "0.00" string must not hide an unpaid premium.
  return premium > 0 ? premium : recordedPayment;
}

function isPayableCustomerInvoice(invoice: CustomerInvoice) {
  const status = String(invoice.paymentStatus || "").toUpperCase();
  if (["PAID", "NOT_REQUIRED", "REFUNDED"].includes(status)) return false;
  const amount = getInvoicePayableAmount(invoice);
  return (
    amount > 0 &&
    (Boolean(invoice.isPaymentRequired) ||
      ["PENDING", "PARTIAL", "FAILED"].includes(status))
  );
}

function isPaidCustomerInvoice(invoice: CustomerInvoice) {
  const status = String(invoice.paymentStatus || "").toUpperCase();
  return status === "PAID";
}

function formatPaymentStatus(status?: string | null) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (!normalized) return "View";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getInvoiceVehicle(invoice: CustomerInvoice | InsuranceForm) {
  return String(
    invoice.vehicleNumber || invoice.truckNumber || "Vehicle not added",
  );
}

function getInvoiceProduct(invoice: CustomerInvoice | InsuranceForm) {
  const product = invoice.productName;
  if (Array.isArray(product))
    return product.filter(Boolean).join(", ") || "Product";
  return String(product || "Product");
}

function getInvoicePdfUrl(invoice: CustomerInvoice | InsuranceForm) {
  return String(invoice.pdfUrl || invoice.pdfURL || "");
}

function getInsuranceDocumentUrl(invoice: CustomerInvoice | InsuranceForm) {
  const insurance = invoice.insurance;
  if (typeof insurance === "string") return insurance;
  return String(
    insurance?.fileUrl ||
      insurance?.url ||
      invoice.insuranceFileUrl ||
      invoice.insuranceUrl ||
      "",
  );
}

function isClosedClaimStatus(status?: string) {
  return ["rejected", "settled", "completed", "closed"].includes(
    String(status || "").toLowerCase(),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  const responseMessage = (
    error as { response?: { data?: { message?: unknown } } }
  )?.response?.data?.message;
  if (Array.isArray(responseMessage))
    return responseMessage.map(String).join(", ");
  if (typeof responseMessage === "string" && responseMessage.trim())
    return responseMessage;

  if (error instanceof Error && error.message) return error.message;

  const directMessage = (error as { message?: unknown })?.message;
  if (Array.isArray(directMessage)) return directMessage.map(String).join(", ");
  if (typeof directMessage === "string" && directMessage.trim())
    return directMessage;

  return fallback;
}

// User Media Upload Section Component
function UserMediaUploadSection({
  label,
  mediaType,
  existingUrl,
  claimId: _claimId,
  onUploadClick,
}: {
  label: string;
  mediaType:
    "fir" | "accidentPic" | "lorryReceipt" | "insurancePolicy" | "damageForm";
  existingUrl?: string | null;
  claimId: string;
  onUploadClick: (
    mediaType:
      "fir" | "accidentPic" | "lorryReceipt" | "insurancePolicy" | "damageForm",
  ) => void;
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
              ? "text-green-600 hover:text-green-800 border border-green-600"
              : "text-blue-600 hover:text-blue-800 border border-blue-600"
          }`}
        >
          {existingUrl ? "Update" : "Upload"}
        </button>
      </div>
    </div>
  );
}

export default HomePage;
