"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BadgeIndianRupee,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Paperclip,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  AdminLedgerUser,
  ChannelPartnerDetailPayload,
  ChannelPartnerInvoicePayload,
  ChannelPartnerStatus,
  ChannelPartnerTripPayload,
  ChannelPartnerCommissionPayload,
  ChannelPartnerProfilePayload,
  ChannelPartnerCustomerPayload,
  ChannelPartnerPaymentPayload,
  ChannelPartnerPaymentCommissionPayload,
  ChannelPartnerSummary,
  adminApi,
} from "@/features/admin/api/admin.api";

type TabKey = "customers" | "invoices" | "commissions" | "payments" | "tracking";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "payments", label: "Payments" },
  { key: "tracking", label: "Tracking" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatPeriod(month: number, year: number) {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

/** One page of the commissions a payout settled — a month can run to thousands. */
type SettledCommissionPage = {
  rows: ChannelPartnerPaymentCommissionPayload[];
  total: number;
  totalPages: number;
  page: number;
};
const TAB_PAGE_SIZE = 50;
const INVOICE_TAB_PAGE_SIZE = 20;
const INVOICE_STATUS_OPTIONS = ["NOT_REQUIRED", "PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"];
const COMMISSION_STATUS_OPTIONS = ["PENDING", "PAYABLE", "PAID", "VOID"];
const TRACKING_STATUS_OPTIONS = ["PENDING", "ACTIVE", "IN_PROGRESS", "ENDED"];
// The user picker pages as you scroll rather than loading every user at once.
const USER_PICKER_PAGE_SIZE = 50;
// Assign in small batches so a large selection stays quick without flooding the API.
const ASSIGN_BATCH_SIZE = 5;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status?: string | null) {
  const norm = String(status || "").toUpperCase();
  if (norm === "ACTIVE" || norm === "APPROVED" || norm === "PAYABLE" || norm === "PAID" || norm === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80";
  }
  if (norm === "PENDING" || norm === "PARTIAL" || norm === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80";
  }
  if (norm === "SUSPENDED" || norm === "REMOVED" || norm === "VOID" || norm === "REJECTED" || norm === "FAILED" || norm === "CANCELLED") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
}

function isRequestCanceled(error: unknown) {
  if (error == null || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: string };
  return candidate.name === "AbortError" || candidate.name === "CanceledError" || candidate.code === "ERR_CANCELED";
}

function searchable(value: unknown) {
  return String(value || "").toLowerCase();
}

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params?.id as string;

  // Core data
  const [profile, setProfile] = useState<ChannelPartnerProfilePayload | null>(null);
  const [customers, setCustomers] = useState<ChannelPartnerCustomerPayload[]>([]);
  const [customerStats, setCustomerStats] = useState<ChannelPartnerDetailPayload['customerStats']>({});
  const [summary, setSummary] = useState<ChannelPartnerSummary | null>(null);
  const [invoices, setInvoices] = useState<ChannelPartnerInvoicePayload[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [commissions, setCommissions] = useState<ChannelPartnerCommissionPayload[]>([]);
  const [trips, setTrips] = useState<ChannelPartnerTripPayload[]>([]);

  // Loading states
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadingCustomerStats, setLoadingCustomerStats] = useState(false);
  const [hasLoadedCustomerStats, setHasLoadedCustomerStats] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("customers");
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState<AdminLedgerUser[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [loadingUserOptions, setLoadingUserOptions] = useState(false);
  const [hasMoreUserOptions, setHasMoreUserOptions] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<AdminLedgerUser[]>([]);
  const [assigningUsers, setAssigningUsers] = useState(false);
  const [payments, setPayments] = useState<ChannelPartnerPaymentPayload[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState(() => {
    const now = new Date();
    // Default to last month: a payout is normally recorded once the month closes.
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      month: previous.getMonth() + 1,
      year: previous.getFullYear(),
      amount: "",
      notes: "",
    };
  });
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<File | null>(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [paymentCommissions, setPaymentCommissions] = useState<
    Record<string, SettledCommissionPage>
  >({});
  const [loadingPaymentCommissions, setLoadingPaymentCommissions] = useState(false);
  const slipInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const userPickerRef = useRef<HTMLDivElement | null>(null);
  const userListRef = useRef<HTMLDivElement | null>(null);
  const userRequestRef = useRef(0);
  const userOptionsRef = useRef<AdminLedgerUser[]>([]);
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionDraft, setCommissionDraft] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);

  // Filters — per-tab (invoices, commissions, tracking). Summary uses summaryFilters.
  const [invoiceCustomerId, setInvoiceCustomerId] = useState("ALL");
  const [rawStartDate, setRawStartDate] = useState("");
  const [rawEndDate, setRawEndDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("ALL");
  const [trackingStatusFilter, setTrackingStatusFilter] = useState("ALL");
  const [commissionsTotal, setCommissionsTotal] = useState(0);
  const [commissionsTotalPages, setCommissionsTotalPages] = useState(1);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [tripsTotalPages, setTripsTotalPages] = useState(1);
  const [tripsPage, setTripsPage] = useState(1);

  // AbortController refs per fetch scope
  const abortSummaryRef = useRef<AbortController | null>(null);
  const abortTabRef = useRef<AbortController | null>(null);

  // 400ms debounce for date inputs (matches insurance payments pattern)
  useEffect(() => {
    const t = setTimeout(() => setStartDate(rawStartDate), 400);
    return () => clearTimeout(t);
  }, [rawStartDate]);

  useEffect(() => {
    const t = setTimeout(() => setEndDate(rawEndDate), 400);
    return () => clearTimeout(t);
  }, [rawEndDate]);

  useEffect(() => {
    if (activeTab !== "invoices") {
      setDebouncedInvoiceSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedInvoiceSearch(tableSearch.trim()), 400);
    return () => clearTimeout(timer);
  }, [activeTab, tableSearch]);

  // Load profile + customer list (fast — no stats, fires when partner changes)
  const loadProfile = useCallback(async () => {
    if (!partnerId) return;
    setLoadingProfile(true);
    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, { scope: "profile" });
      if (response.success && response.data) {
        setProfile(response.data.profile ?? null);
        setCustomers(response.data.customers ?? []);
        setHasLoadedCustomerStats(false);
        setCustomerStats({});
      } else {
        toast.error(response.message ?? "Failed to load channel partner profile");
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [partnerId]);

  // Load summary metrics (lightweight — 2 parallel queries on backend)
  const loadSummary = useCallback(async () => {
    if (!partnerId) return;

    // Cancel previous in-flight summary request
    const controller = new AbortController();
    abortSummaryRef.current?.abort();
    abortSummaryRef.current = controller;

    setLoadingSummary(true);
    const filters: Parameters<typeof adminApi.getChannelPartnerDetail>[1] = { scope: "summary" };

    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, filters, { signal: controller.signal });
      if (response.success && response.data) {
        if (response.data.summary) {
          setSummary(response.data.summary);
        }
      } else {
        toast.error(response.message ?? "Failed to load channel partner summary");
      }
    } catch (error: unknown) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message ?? "Failed to load channel partner summary");
      }
    } finally {
      if (abortSummaryRef.current === controller) {
        setLoadingSummary(false);
      }
    }
  }, [partnerId]);

  // Load per-customer stats lazily (only when Customers tab is active)
  const loadCustomerStats = useCallback(async () => {
    if (!partnerId) return;
    if (!customers.length) {
      setCustomerStats({});
      setHasLoadedCustomerStats(true);
      return;
    }
    setLoadingCustomerStats(true);
    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, { scope: "customer-stats" });
      if (response.success && response.data?.customerStats) {
        setCustomerStats(response.data.customerStats);
        setHasLoadedCustomerStats(true);
      } else {
        toast.error(response.message ?? "Failed to load customer stats");
        setHasLoadedCustomerStats(true);
      }
    } finally {
      setLoadingCustomerStats(false);
    }
  }, [partnerId, customers.length]);

  const loadInvoicesTabData = useCallback(async (page = 1) => {
    if (!partnerId) return;
    const controller = new AbortController();
    abortTabRef.current?.abort();
    abortTabRef.current = controller;

    setLoadingTab(true);
    const filters: Parameters<typeof adminApi.getChannelPartnerDetail>[1] = {
      scope: "invoices",
      page,
      limit: INVOICE_TAB_PAGE_SIZE,
    };

    if (invoiceCustomerId !== "ALL") filters.customerId = invoiceCustomerId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (invoiceStatusFilter !== "ALL") filters.status = invoiceStatusFilter;
    if (debouncedInvoiceSearch) filters.invoiceSearch = debouncedInvoiceSearch;

    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, filters, { signal: controller.signal });
      if (response.success && response.data) {
        setInvoices(response.data.invoices ?? []);
        setInvoicesTotal(response.data.total ?? 0);
        setInvoicesTotalPages(Math.max(1, Number(response.data.totalPages || 0) || 1));
        setInvoicesPage(response.data.page ?? page);
      } else {
        toast.error(response.message ?? "Failed to load invoices");
      }
    } catch (error: unknown) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message ?? "Failed to load invoices");
      }
    } finally {
      if (abortTabRef.current === controller) {
        setLoadingTab(false);
      }
    }
  }, [partnerId, invoiceCustomerId, startDate, endDate, invoiceStatusFilter, debouncedInvoiceSearch]);

  const loadCommissionsTabData = useCallback(async (page = 1) => {
    if (!partnerId) return;
    const controller = new AbortController();
    abortTabRef.current?.abort();
    abortTabRef.current = controller;

    setLoadingTab(true);
    const filters: Parameters<typeof adminApi.getChannelPartnerDetail>[1] = {
      scope: "commissions",
      page,
      limit: TAB_PAGE_SIZE,
    };

    if (commissionStatusFilter !== "ALL") filters.status = commissionStatusFilter;

    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, filters, { signal: controller.signal });
      if (response.success && response.data) {
        setCommissions(response.data.commissions ?? []);
        setCommissionsTotal(response.data.total ?? 0);
        setCommissionsTotalPages(Math.max(1, Number(response.data.totalPages || 0) || 1));
        setCommissionsPage(response.data.page ?? page);
      } else {
        toast.error(response.message ?? "Failed to load commissions");
      }
    } catch (error: unknown) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message ?? "Failed to load commissions");
      }
    } finally {
      if (abortTabRef.current === controller) {
        setLoadingTab(false);
      }
    }
  }, [partnerId, commissionStatusFilter]);

  const loadTrackingTabData = useCallback(async (page = 1) => {
    if (!partnerId) return;
    const controller = new AbortController();
    abortTabRef.current?.abort();
    abortTabRef.current = controller;

    setLoadingTab(true);
    const filters: Parameters<typeof adminApi.getChannelPartnerDetail>[1] = {
      scope: "trips",
      page,
      limit: TAB_PAGE_SIZE,
    };

    if (trackingStatusFilter !== "ALL") filters.status = trackingStatusFilter;

    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, filters, { signal: controller.signal });
      if (response.success && response.data) {
        setTrips(response.data.trips ?? []);
        setTripsTotal(response.data.total ?? 0);
        setTripsTotalPages(Math.max(1, Number(response.data.totalPages || 0) || 1));
        setTripsPage(response.data.page ?? page);
      } else {
        toast.error(response.message ?? "Failed to load trips");
      }
    } catch (error: unknown) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message ?? "Failed to load trips");
      }
    } finally {
      if (abortTabRef.current === controller) {
        setLoadingTab(false);
      }
    }
  }, [partnerId, trackingStatusFilter]);

  const loadPayments = useCallback(async () => {
    if (!partnerId) return;
    setLoadingPayments(true);
    try {
      const response = await adminApi.getChannelPartnerPayments(partnerId);
      if (response.success) {
        setPayments(response.data ?? []);
      } else {
        toast.error(response.message ?? "Failed to load payments");
      }
    } finally {
      setLoadingPayments(false);
    }
  }, [partnerId]);

  const loadPaymentCommissions = async (paymentId: string, page: number) => {
    setLoadingPaymentCommissions(true);
    try {
      const response = await adminApi.getChannelPartnerPaymentCommissions(paymentId, page);
      if (response.success) {
        setPaymentCommissions((prev) => ({
          ...prev,
          [paymentId]: {
            rows: response.data ?? [],
            total: response.total ?? 0,
            totalPages: response.totalPages ?? 1,
            page: response.page ?? page,
          },
        }));
      } else {
        toast.error(response.message ?? "Failed to load settled invoices");
      }
    } finally {
      setLoadingPaymentCommissions(false);
    }
  };

  const togglePaymentRow = async (paymentId: string) => {
    if (expandedPaymentId === paymentId) {
      setExpandedPaymentId(null);
      return;
    }
    setExpandedPaymentId(paymentId);
    if (paymentCommissions[paymentId]) return;
    await loadPaymentCommissions(paymentId, 1);
  };

  const savePayment = async () => {
    if (!partnerId) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }

    setSavingPayment(true);
    try {
      const response = await adminApi.recordChannelPartnerPayment(partnerId, {
        month: paymentForm.month,
        year: paymentForm.year,
        amount,
        notes: paymentForm.notes.trim() || undefined,
        slip: paymentSlip,
        invoice: paymentInvoice,
      });
      if (!response.success) {
        toast.error(response.message ?? "Failed to record payment");
        return;
      }

      const settled = response.settledCount ?? 0;
      toast.success(
        settled
          ? `Payment recorded · ${settled} ${settled === 1 ? "commission" : "commissions"} marked paid`
          : "Payment recorded",
      );
      setPaymentForm((prev) => ({ ...prev, amount: "", notes: "" }));
      setPaymentSlip(null);
      setPaymentInvoice(null);
      if (slipInputRef.current) slipInputRef.current.value = "";
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
      // Settling changes the commission statuses the metrics are built from.
      setPaymentCommissions({});
      setExpandedPaymentId(null);
      await Promise.all([loadPayments(), loadSummary()]);
    } finally {
      setSavingPayment(false);
    }
  };

  const removePayment = async (payment: ChannelPartnerPaymentPayload) => {
    const label = formatPeriod(payment.month, payment.year);
    if (!window.confirm(`Delete the ${label} payment of ${formatCurrency(payment.amount)}? Its commissions go back to unpaid unless another payment covers that month.`)) {
      return;
    }
    const response = await adminApi.deleteChannelPartnerPayment(payment.id);
    if (!response.success) {
      toast.error(response.message ?? "Failed to delete payment");
      return;
    }
    const reverted = response.data?.revertedCount ?? 0;
    toast.success(
      reverted
        ? `Payment deleted · ${reverted} ${reverted === 1 ? "commission" : "commissions"} reopened`
        : "Payment deleted",
    );
    setPaymentCommissions({});
    setExpandedPaymentId(null);
    await Promise.all([loadPayments(), loadSummary()]);
  };

  const loadTabData = useCallback(
    (page = 1) => {
      if (activeTab === "invoices") return loadInvoicesTabData(page);
      if (activeTab === "commissions") return loadCommissionsTabData(page);
      if (activeTab === "tracking") return loadTrackingTabData(page);
      return Promise.resolve();
    },
    [activeTab, loadInvoicesTabData, loadCommissionsTabData, loadTrackingTabData],
  );

  // Mount: load profile for the selected partner
  useEffect(() => {
    void loadProfile();
  }, [partnerId, loadProfile]);

  // Summary: refetch when partner changes
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Tab data: invoices scope and filters
  useEffect(() => {
    if (activeTab === "invoices") {
      void loadInvoicesTabData(1);
    }
  }, [activeTab, loadInvoicesTabData]);

  // Tab data: commissions scope and filters
  useEffect(() => {
    if (activeTab === "commissions") {
      void loadCommissionsTabData(1);
    }
  }, [activeTab, loadCommissionsTabData]);

  // Tab data: tracking scope and filters
  useEffect(() => {
    if (activeTab === "tracking") {
      void loadTrackingTabData(1);
    }
  }, [activeTab, loadTrackingTabData]);

  // Tab data: payments
  useEffect(() => {
    if (activeTab === "payments") {
      void loadPayments();
    }
  }, [activeTab, loadPayments]);

  // Customers tab: load customer stats lazily
  useEffect(() => {
    if (activeTab === "customers" && !loadingProfile && !loadingCustomerStats && !hasLoadedCustomerStats) {
      void loadCustomerStats();
    }
  }, [activeTab, loadingProfile, loadingCustomerStats, hasLoadedCustomerStats, loadCustomerStats]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      abortSummaryRef.current?.abort();
      abortTabRef.current?.abort();
    };
  }, []);

  const selectedPartner = profile;
  const q = tableSearch.trim().toLowerCase();

  const dynamicSummary = useMemo(() => {
    return (
      summary ?? {
        customers: 0,
        invoices: 0,
        premiumTotal: 0,
        commissionPending: 0,
        commissionPayable: 0,
        commissionPaid: 0,
        activeTrips: 0,
      }
    );
  }, [summary]);

  // Customers rows — names available immediately, stats filled when customerStats resolves
  const customerRows = useMemo(() => {
    const rows = customers;
    if (!q) return rows;
    return rows.filter((row) =>
      [row.customer.name, row.customer.mobileNumber, row.customer.identity, row.status].some(
        (item) => searchable(item).includes(q),
      ),
    );
  }, [customers, q]);

  const invoiceRows = useMemo(() => {
    return invoices;
  }, [invoices]);

  const commissionRows = useMemo(() => {
    if (!q) return commissions;
    return commissions.filter((row) =>
      [row.invoiceNumber, row.invoiceId, row.customer?.name, row.customer?.mobileNumber, row.status].some(
        (item) => searchable(item).includes(q),
      ),
    );
  }, [commissions, q]);

  const tripRows = useMemo(() => {
    if (!q) return trips;
    return trips.filter((row) =>
      [row.vehicleNumber, row.invoice?.invoiceNumber, row.src, row.dest, row.status, row.lastLocation?.address].some(
        (item) => searchable(item).includes(q),
      ),
    );
  }, [trips, q]);

  const paymentRows = useMemo(() => {
    if (!q) return payments;
    return payments.filter((row) =>
      [formatPeriod(row.month, row.year), String(row.amount), row.notes].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payments, q]);

  const totalPaidOut = useMemo(
    () => payments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [payments],
  );

  const availableStatuses = useMemo(() => {
    if (activeTab === "invoices") {
      return INVOICE_STATUS_OPTIONS;
    }
    if (activeTab === "commissions") {
      return COMMISSION_STATUS_OPTIONS;
    }
    if (activeTab === "tracking") {
      return TRACKING_STATUS_OPTIONS;
    }
    return [];
  }, [activeTab]);

  const activeStatusFilter = useMemo(() => {
    if (activeTab === "invoices") return invoiceStatusFilter;
    if (activeTab === "commissions") return commissionStatusFilter;
    if (activeTab === "tracking") return trackingStatusFilter;
    return "ALL";
  }, [activeTab, invoiceStatusFilter, commissionStatusFilter, trackingStatusFilter]);

  const setActiveStatusFilter = useCallback((value: string) => {
    if (activeTab === "invoices") setInvoiceStatusFilter(value);
    else if (activeTab === "commissions") setCommissionStatusFilter(value);
    else if (activeTab === "tracking") setTrackingStatusFilter(value);
  }, [activeTab]);

  const handleStatus = async (status: ChannelPartnerStatus) => {
    if (!selectedPartner?.id) return;
    const response = await adminApi.updateChannelPartnerStatus(selectedPartner.id, status);
    if (!response.success) {
      toast.error(response.message ?? "Failed to update partner");
      return;
    }
    toast.success("Channel partner status updated");
    await loadProfile();
  };

  const startEditCommission = () => {
    const percent = Number(selectedPartner?.commissionRate || 0) * 100;
    setCommissionDraft(String(Number(percent.toFixed(2))));
    setEditingCommission(true);
  };

  const saveCommission = async () => {
    if (!selectedPartner?.id) return;
    const percent = Number(commissionDraft);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error("Commission rate must be between 0 and 100");
      return;
    }
    const rate = Number((percent / 100).toFixed(4));
    setSavingCommission(true);
    try {
      const response = await adminApi.updateChannelPartner(selectedPartner.id, {
        commissionRate: rate,
      });
      if (!response.success) {
        toast.error(
          (Array.isArray(response.message)
            ? response.message.join(", ")
            : response.message) || "Failed to update commission rate",
        );
        return;
      }
      const nextRate = Number(response.data?.commissionRate ?? rate);
      setProfile((prev) => (prev ? { ...prev, commissionRate: nextRate } : prev));
      toast.success("Commission updated. Unpaid commissions recalculated; paid unchanged.");
      setEditingCommission(false);
      await loadProfile();
      void loadSummary();
      if (activeTab === "commissions") {
        void loadCommissionsTabData(1);
      }
    } finally {
      setSavingCommission(false);
    }
  };

  // Customers already linked to this partner cannot be picked again.
  const linkedCustomerIds = useMemo(
    () => new Set(customers.map((row) => row.customer.id)),
    [customers],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadUserOptions = useCallback(async (query: string, offset: number) => {
    // Only the newest request may write: an earlier page can land after a newer search.
    const requestId = offset === 0 ? ++userRequestRef.current : userRequestRef.current;
    setLoadingUserOptions(true);
    try {
      const response = await adminApi.searchUsers(query, USER_PICKER_PAGE_SIZE, { offset });
      if (requestId !== userRequestRef.current) return;
      if (!response.success) {
        toast.error(response.message ?? "Failed to load users");
        return;
      }
      const rows = response.data ?? [];
      if (!offset) {
        userOptionsRef.current = rows;
        setUserOptions(rows);
        setHasMoreUserOptions(rows.length === USER_PICKER_PAGE_SIZE);
        return;
      }
      // Append by id: a page that repeats what we already hold (an API that ignores
      // offset, or a user created between pages) must not duplicate rows or loop.
      const seen = new Set(userOptionsRef.current.map((row) => row.id));
      const additions = rows.filter((row) => !seen.has(row.id));
      setHasMoreUserOptions(additions.length > 0 && rows.length === USER_PICKER_PAGE_SIZE);
      if (additions.length) {
        userOptionsRef.current = [...userOptionsRef.current, ...additions];
        setUserOptions(userOptionsRef.current);
      }
    } finally {
      if (requestId === userRequestRef.current) setLoadingUserOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!userPickerOpen) return;
    if (userListRef.current) userListRef.current.scrollTop = 0;
    void loadUserOptions(debouncedUserSearch, 0);
  }, [userPickerOpen, debouncedUserSearch, loadUserOptions]);

  useEffect(() => {
    if (!userPickerOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userPickerRef.current?.contains(event.target as Node)) setUserPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserPickerOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userPickerOpen]);

  const handleUserListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    if (loadingUserOptions || !hasMoreUserOptions) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight > 96) return;
    void loadUserOptions(debouncedUserSearch, userOptions.length);
  };

  const toggleUserSelection = (user: AdminLedgerUser) => {
    setSelectedUsers((prev) =>
      prev.some((row) => row.id === user.id)
        ? prev.filter((row) => row.id !== user.id)
        : [...prev, user],
    );
  };

  const assignSelectedUsers = async () => {
    const partnerProfileId = selectedPartner?.id;
    if (!partnerProfileId || !selectedUsers.length) return;
    setAssigningUsers(true);
    try {
      const failures: Array<{ id: string; label: string; message: string }> = [];
      let assigned = 0;

      for (let index = 0; index < selectedUsers.length; index += ASSIGN_BATCH_SIZE) {
        const batch = selectedUsers.slice(index, index + ASSIGN_BATCH_SIZE);
        const responses = await Promise.all(
          batch.map((user) => adminApi.addChannelPartnerCustomer(partnerProfileId, user.id)),
        );
        responses.forEach((response, position) => {
          const user = batch[position];
          if (response.success) {
            assigned += 1;
            return;
          }
          failures.push({
            id: user.id,
            label: user.name || user.mobileNumber || "User",
            message: response.message ?? "Failed to assign",
          });
        });
      }

      if (assigned) {
        toast.success(assigned === 1 ? "1 customer assigned" : `${assigned} customers assigned`);
      }
      if (failures.length <= 3) {
        failures.forEach((failure) => toast.error(`${failure.label}: ${failure.message}`));
      } else {
        toast.error(`${failures.length} could not be assigned — ${failures[0].message}`);
      }

      // Keep the ones that failed selected so they can be retried or dropped.
      const failedIds = new Set(failures.map((failure) => failure.id));
      setSelectedUsers((prev) => prev.filter((user) => failedIds.has(user.id)));

      if (assigned) {
        setUserPickerOpen(false);
        setUserSearch("");
        void Promise.all([loadProfile(), loadSummary()]);
        void loadCustomerStats();
      }
    } finally {
      setAssigningUsers(false);
    }
  };

  const updateLink = async (linkId: string, status: "APPROVED" | "REMOVED") => {
    const response = await adminApi.updateChannelPartnerCustomerLink(linkId, status);
    if (!response.success) {
      toast.error(response.message ?? "Failed to update link");
      return;
    }
    toast.success(status === "APPROVED" ? "Customer link approved" : "Customer link removed");
    void Promise.all([loadProfile(), loadSummary()]);
    if (activeTab === "customers") {
      void loadCustomerStats();
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500 font-sans">Loading channel partner analytics...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 font-sans">
        <p className="text-slate-500">Channel partner profile not found.</p>
        <button
          onClick={() => router.push("/admin/channel-partners")}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 sm:px-8 lg:px-12 font-sans text-slate-900">
      {/* Header */}
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-lg shadow-md shadow-blue-500/10">
              M+
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {selectedPartner?.partnerUser?.name || "Channel Partner"}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>
                  Code: <span className="text-slate-700">{selectedPartner?.code || "-"}</span>
                </span>
                <span aria-hidden>·</span>
                {editingCommission ? (
                  <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={commissionDraft}
                      onChange={(event) => setCommissionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveCommission();
                        if (event.key === "Escape") setEditingCommission(false);
                      }}
                      className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
                      autoFocus
                    />
                    <span className="font-bold text-slate-700">%</span>
                    <button
                      type="button"
                      onClick={() => void saveCommission()}
                      disabled={savingCommission}
                      className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCommission(false)}
                      disabled={savingCommission}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                    <span className="font-bold text-slate-700">
                      {(Number(selectedPartner?.commissionRate || 0) * 100).toFixed(
                        Number(selectedPartner?.commissionRate || 0) * 100 % 1 === 0 ? 0 : 2,
                      )}
                      % commission
                    </span>
                    <button
                      type="button"
                      onClick={startEditCommission}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      title="Edit commission rate"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedPartner?.status !== "ACTIVE" ? (
              <button
                type="button"
                onClick={() => void handleStatus("ACTIVE")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm transition"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve Partner
              </button>
            ) : null}

          </div>
        </div>



        {/* Analytics & Content Layout */}
        <div className="space-y-6">
          {/* Metrics */}
          <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 transition-opacity duration-200 ${loadingSummary ? 'opacity-65' : ''}`}>
            <Metric icon={Users} label="Customers" value={String(dynamicSummary.customers)} color="blue" />
            <Metric icon={FileText} label="Invoices" value={String(dynamicSummary.invoices)} color="slate" />
            <Metric icon={BadgeIndianRupee} label="Premium Total" value={formatCurrency(dynamicSummary.premiumTotal)} color="emerald" />
            <Metric icon={BadgeIndianRupee} label="Pending Comm." value={formatCurrency(dynamicSummary.commissionPending)} color="amber" />
            <Metric icon={BadgeIndianRupee} label="Paid Comm." value={formatCurrency(dynamicSummary.commissionPaid)} color="violet" />
          </div>

          {/* Customer Assignment Panel */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Assign Customers to Partner</h3>
              {selectedUsers.length ? (
                <button
                  type="button"
                  onClick={() => setSelectedUsers([])}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
                >
                  Clear selection
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div ref={userPickerRef} className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(event) => {
                      setUserSearch(event.target.value);
                      setUserPickerOpen(true);
                    }}
                    onFocus={() => setUserPickerOpen(true)}
                    role="combobox"
                    aria-expanded={userPickerOpen}
                    aria-controls="channel-partner-user-picker"
                    placeholder="Tap to browse users, or type a name or mobile number..."
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
                  />
                </div>

                {userPickerOpen ? (
                  <div
                    id="channel-partner-user-picker"
                    className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
                    <div
                      ref={userListRef}
                      onScroll={handleUserListScroll}
                      className="max-h-80 overflow-y-auto divide-y divide-slate-100"
                    >
                      {userOptions.map((user) => {
                        const alreadyAssigned = linkedCustomerIds.has(user.id);
                        const checked = selectedUsers.some((row) => row.id === user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                              alreadyAssigned
                                ? "cursor-not-allowed opacity-60"
                                : `cursor-pointer ${checked ? "bg-blue-50/60" : "hover:bg-slate-50"}`
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={alreadyAssigned}
                              onChange={() => toggleUserSelection(user)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-slate-900">
                                {user.name || "Unnamed user"}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {user.mobileNumber}
                                {user.state ? ` · ${user.state}` : ""}
                              </span>
                            </span>
                            {alreadyAssigned ? (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                Assigned
                              </span>
                            ) : null}
                          </label>
                        );
                      })}

                      {loadingUserOptions ? (
                        <p className="px-4 py-3 text-xs font-medium text-slate-500">Loading users...</p>
                      ) : null}
                      {!loadingUserOptions && !userOptions.length ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">
                          {debouncedUserSearch ? "No users match this search." : "No users found."}
                        </p>
                      ) : null}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
                      {selectedUsers.length
                        ? `${selectedUsers.length} selected · scroll for more`
                        : "Select as many as you need · scroll for more"}
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void assignSelectedUsers()}
                disabled={!selectedUsers.length || assigningUsers}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition"
              >
                <UserPlus className="h-4 w-4" />
                {assigningUsers
                  ? "Assigning..."
                  : selectedUsers.length > 1
                    ? `Assign ${selectedUsers.length} Users`
                    : "Assign User"}
              </button>
            </div>

            {selectedUsers.length ? (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-700"
                  >
                    <span className="max-w-[180px] truncate">{user.name || user.mobileNumber}</span>
                    <button
                      type="button"
                      onClick={() => toggleUserSelection(user)}
                      aria-label={`Remove ${user.name || user.mobileNumber}`}
                      className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Details Tables Segment */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
            {/* Table Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="inline-flex rounded-xl border border-slate-200/60 bg-slate-100 p-1 gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setTableSearch("");
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      activeTab === tab.key
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/30"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 flex-wrap justify-end gap-2 max-w-lg">
                {availableStatuses.length && activeTab !== "customers" ? (
                  <select
                    value={activeStatusFilter}
                    onChange={(event) => setActiveStatusFilter(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value="ALL">All statuses</option>
                    {availableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="min-w-[16rem] flex-1">
                  <SearchBox
                    value={tableSearch}
                    onChange={setTableSearch}
                    placeholder={`Search ${activeTab}...`}
                  />
                </div>
              </div>
            </div>

            {/* Conditional Filter Bar for Invoices Tab */}
            {activeTab === "invoices" && (
              <div className="flex flex-wrap items-center gap-5 border-b border-slate-200/60 bg-slate-50/50 px-6 py-3.5 text-xs text-slate-700">
                {/* Select Customer */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Customer:</span>
                  <select
                    value={invoiceCustomerId}
                    onChange={(e) => setInvoiceCustomerId(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="ALL">All Customers</option>
                    {customers.map((c) => (
                      <option key={c.customer.id} value={c.customer.id}>
                        {c.customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range inputs */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Date Range:</span>
                  <input
                    type="date"
                    value={rawStartDate}
                    onChange={(e) => setRawStartDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 outline-none focus:border-blue-400"
                  />
                  <span className="text-slate-400 font-bold">to</span>
                  <input
                    type="date"
                    value={rawEndDate}
                    onChange={(e) => setRawEndDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>

                {/* Clear Filters button */}
                {(invoiceCustomerId !== "ALL" || rawStartDate || rawEndDate || invoiceStatusFilter !== "ALL") && (
                  <button
                    onClick={() => {
                      setInvoiceCustomerId("ALL");
                      setRawStartDate("");
                      setRawEndDate("");
                      setInvoiceStatusFilter("ALL");
                    }}
                    className="ml-auto text-blue-600 hover:text-blue-800 font-bold transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Rendered Table */}
            <div className="relative overflow-x-auto min-h-[300px]">
              {loadingTab && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10 transition-opacity">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              )}
              <div className={loadingTab ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
                {activeTab === "customers" ? (
                  <CustomersTable rows={customerRows} onUpdateLink={updateLink} customerStats={customerStats} loadingStats={loadingCustomerStats} />
                ) : activeTab === "invoices" ? (
                  <>
                    <InvoicesTable rows={invoiceRows} />
                    {invoicesTotalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <span className="text-xs text-slate-500 font-semibold">
                          Showing {invoices.length} of {invoicesTotal} invoices · Page {invoicesPage} of {invoicesTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={invoicesPage <= 1 || loadingTab}
                            onClick={() => void loadTabData(invoicesPage - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            disabled={invoicesPage >= invoicesTotalPages || loadingTab}
                            onClick={() => void loadTabData(invoicesPage + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : activeTab === "commissions" ? (
                  <>
                    <CommissionsTable rows={commissionRows} />
                    {commissionsTotalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <span className="text-xs text-slate-500 font-semibold">
                          Showing {commissions.length} of {commissionsTotal} commissions · Page {commissionsPage} of {commissionsTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={commissionsPage <= 1 || loadingTab}
                            onClick={() => void loadTabData(commissionsPage - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            disabled={commissionsPage >= commissionsTotalPages || loadingTab}
                            onClick={() => void loadTabData(commissionsPage + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : activeTab === "payments" ? (
                  <PaymentsPanel
                    rows={paymentRows}
                    totalPaidOut={totalPaidOut}
                    loading={loadingPayments}
                    saving={savingPayment}
                    form={paymentForm}
                    onFormChange={setPaymentForm}
                    slip={paymentSlip}
                    onSlipChange={setPaymentSlip}
                    slipInputRef={slipInputRef}
                    invoice={paymentInvoice}
                    onInvoiceChange={setPaymentInvoice}
                    invoiceInputRef={invoiceInputRef}
                    onSave={() => void savePayment()}
                    onDelete={(payment) => void removePayment(payment)}
                    expandedPaymentId={expandedPaymentId}
                    onToggleRow={(paymentId) => void togglePaymentRow(paymentId)}
                    onCommissionsPageChange={(paymentId, page) =>
                      void loadPaymentCommissions(paymentId, page)
                    }
                    commissionsByPayment={paymentCommissions}
                    loadingCommissions={loadingPaymentCommissions}
                  />
                ) : (
                  <>
                    <TrackingTable rows={tripRows} />
                    {tripsTotalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <span className="text-xs text-slate-500 font-semibold">
                          Showing {trips.length} of {tripsTotal} trips · Page {tripsPage} of {tripsTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={tripsPage <= 1 || loadingTab}
                            onClick={() => void loadTabData(tripsPage - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            disabled={tripsPage >= tripsTotalPages || loadingTab}
                            onClick={() => void loadTabData(tripsPage + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsPanel({
  rows,
  totalPaidOut,
  loading,
  saving,
  form,
  onFormChange,
  slip,
  onSlipChange,
  slipInputRef,
  invoice,
  onInvoiceChange,
  invoiceInputRef,
  onSave,
  onDelete,
  expandedPaymentId,
  onToggleRow,
  commissionsByPayment,
  loadingCommissions,
  onCommissionsPageChange,
}: {
  rows: ChannelPartnerPaymentPayload[];
  totalPaidOut: number;
  loading: boolean;
  saving: boolean;
  form: { month: number; year: number; amount: string; notes: string };
  onFormChange: React.Dispatch<
    React.SetStateAction<{ month: number; year: number; amount: string; notes: string }>
  >;
  slip: File | null;
  onSlipChange: (file: File | null) => void;
  slipInputRef: React.RefObject<HTMLInputElement | null>;
  invoice: File | null;
  onInvoiceChange: (file: File | null) => void;
  invoiceInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onDelete: (payment: ChannelPartnerPaymentPayload) => void;
  expandedPaymentId: string | null;
  onToggleRow: (paymentId: string) => void;
  commissionsByPayment: Record<string, SettledCommissionPage>;
  loadingCommissions: boolean;
  onCommissionsPageChange: (paymentId: string, page: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <div>
      {/* Record a payout */}
      <div className="border-b border-slate-200/60 bg-slate-50/50 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Record a Commission Payment
          </h4>
          <span className="text-xs font-semibold text-slate-500">
            Paid out so far: {formatCurrency(totalPaidOut)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Month</span>
            <select
              value={form.month}
              onChange={(event) => onFormChange((prev) => ({ ...prev, month: Number(event.target.value) }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Year</span>
            <select
              value={form.year}
              onChange={(event) => onFormChange((prev) => ({ ...prev, year: Number(event.target.value) }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Amount paid</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => onFormChange((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Payment slip <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span>
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2">
              <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={slipInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => onSlipChange(event.target.files?.[0] ?? null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Payment invoice <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span>
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2">
              <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={invoiceInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => onInvoiceChange(event.target.files?.[0] ?? null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
              />
            </div>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              <BadgeIndianRupee className="h-4 w-4" />
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </div>

        <input
          value={form.notes}
          onChange={(event) => onFormChange((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Reference or note (optional)"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
        />

        <p className="mt-3 text-xs text-slate-500">
          Saving marks every commission on that month&apos;s invoices as paid, and the Paid Commission
          metric moves with it.
          {slip ? ` Slip: ${slip.name}.` : ""}
          {invoice ? ` Invoice: ${invoice.name}.` : ""}
        </p>
      </div>

      {/* Recorded payouts */}
      <Table>
        <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <Th>Period</Th>
            <Th>Amount Paid</Th>
            <Th>Month&apos;s Commission</Th>
            <Th>Settled</Th>
            <Th>Documents</Th>
            <Th>Recorded</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const expanded = expandedPaymentId === row.id;
            const settledRows = commissionsByPayment[row.id];
            return (
              <Fragment key={row.id}>
                <tr
                  onClick={() => onToggleRow(row.id)}
                  className={`cursor-pointer transition-colors ${expanded ? "bg-blue-50/40" : "hover:bg-slate-50/50"}`}
                >
                  <Td>
                    <p className="font-semibold text-slate-950">{formatPeriod(row.month, row.year)}</p>
                    {row.notes ? <p className="mt-0.5 text-xs text-slate-500">{row.notes}</p> : null}
                  </Td>
                  <Td className="font-bold text-slate-900">{formatCurrency(row.amount)}</Td>
                  <Td className="text-slate-600">
                    {formatCurrency(row.commissionTotal)}
                    <span className="ml-1 text-xs text-slate-400">
                      ({row.commissionCount} {row.commissionCount === 1 ? "invoice" : "invoices"})
                    </span>
                  </Td>
                  <Td className="text-slate-600">
                    {row.settledCount} of {row.commissionCount}
                  </Td>
                  <Td>
                    {row.slipUrl || row.invoiceUrl ? (
                      <div className="flex flex-col gap-1">
                        {row.slipUrl ? (
                          <a
                            href={row.slipUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Slip
                          </a>
                        ) : null}
                        {row.invoiceUrl ? (
                          <a
                            href={row.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Invoice
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </Td>
                  <Td className="text-slate-500">{formatDate(row.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(row);
                        }}
                        aria-label={`Delete the ${formatPeriod(row.month, row.year)} payment`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </Td>
                </tr>

                {expanded ? (
                  <tr className="bg-slate-50/40">
                    <td colSpan={7} className="px-6 py-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Invoices in {formatPeriod(row.month, row.year)}
                      </p>
                      {!settledRows ? (
                        <p className="text-sm text-slate-500">
                          {loadingCommissions ? "Loading invoices..." : "No invoices loaded."}
                        </p>
                      ) : !settledRows.rows.length ? (
                        <p className="text-sm text-slate-500">
                          No commissions were raised for this month.
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <Th>Invoice</Th>
                                <Th>Customer</Th>
                                <Th>Premium</Th>
                                <Th>Commission</Th>
                                <Th>Status</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {settledRows.rows.map((commission) => (
                                <tr key={commission.id}>
                                  <Td>
                                    <p className="font-semibold text-slate-950">
                                      {commission.invoiceNumber || commission.invoiceId}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {formatDate(commission.invoiceDate)}
                                    </p>
                                  </Td>
                                  <Td>
                                    <p className="font-semibold text-slate-900">
                                      {commission.customer?.name || "-"}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {commission.customer?.mobileNumber || ""}
                                    </p>
                                  </Td>
                                  <Td className="text-slate-600">
                                    {formatCurrency(commission.premiumAmount)}
                                  </Td>
                                  <Td className="font-bold text-slate-900">
                                    {formatCurrency(commission.commissionAmount)}
                                  </Td>
                                  <Td><StatusPill status={commission.status} /></Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {settledRows.totalPages > 1 ? (
                            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                              <span className="text-xs font-semibold text-slate-500">
                                Showing {settledRows.rows.length} of {settledRows.total} invoices ·
                                Page {settledRows.page} of {settledRows.totalPages}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={settledRows.page <= 1 || loadingCommissions}
                                  onClick={() => onCommissionsPageChange(row.id, settledRows.page - 1)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={settledRows.page >= settledRows.totalPages || loadingCommissions}
                                  onClick={() => onCommissionsPageChange(row.id, settledRows.page + 1)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {!rows.length ? (
            <EmptyRow
              colSpan={7}
              label={loading ? "Loading payments..." : "No payments recorded for this partner yet."}
            />
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none text-slate-700"
      />
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(status)}`}>
      {status || "-"}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  color = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: "slate" | "blue" | "emerald" | "amber" | "indigo" | "violet";
}) {
  const bgMap = {
    slate: "bg-slate-50 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 text-slate-400">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className={`p-2.5 rounded-xl ${bgMap[color] || bgMap.slate}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function CustomersTable({
  rows,
  onUpdateLink,
  customerStats,
  loadingStats,
}: {
  rows: ChannelPartnerDetailPayload["customers"];
  onUpdateLink: (linkId: string, status: "APPROVED" | "REMOVED") => void;
  customerStats?: ChannelPartnerDetailPayload["customerStats"];
  loadingStats?: boolean;
}) {
  const statsAvailable = !loadingStats && customerStats && Object.keys(customerStats).length > 0;

  return (
    <Table>
      <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <Th>Customer</Th>
          <Th>Status</Th>
          <Th>Invoices</Th>
          <Th>Premium</Th>
          <Th>Pending Payments</Th>
          <Th>Last Invoice</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows?.map((row) => {
          const stats = statsAvailable ? customerStats?.[row.customer.id] : null;
          return (
            <tr key={row.linkId} className="hover:bg-slate-50/50 transition-colors">
              <Td>
                <p>
                  <Link
                    href={`/admin/channel-partners/customer/${row.customer.id}`}
                    target="_blank"
                    className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {row.customer.name}
                  </Link>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {row.customer.mobileNumber} · {row.customer.identity || "No identity"}
                </p>
              </Td>
              <Td><StatusPill status={row.status} /></Td>
              {loadingStats && !statsAvailable ? (
                <>
                  <Td><span className="inline-block h-4 w-8 rounded bg-slate-200 animate-pulse" /></Td>
                  <Td><span className="inline-block h-4 w-16 rounded bg-slate-200 animate-pulse" /></Td>
                  <Td><span className="inline-block h-4 w-6 rounded bg-slate-200 animate-pulse" /></Td>
                  <Td><span className="inline-block h-4 w-20 rounded bg-slate-200 animate-pulse" /></Td>
                </>
              ) : (
                <>
                  <Td className="font-semibold text-slate-700">{stats?.invoices ?? "—"}</Td>
                  <Td className="font-semibold text-slate-900">{stats ? formatCurrency(stats.premiumTotal) : "—"}</Td>
                  <Td className="font-semibold text-slate-700">{stats?.pendingPayments ?? "—"}</Td>
                  <Td className="text-slate-500">{stats ? formatDate(stats.lastInvoiceDate) : "—"}</Td>
                </>
              )}
              <Td>
                <div className="flex gap-2">
                  {row.status !== "APPROVED" ? (
                    <button
                      type="button"
                      onClick={() => onUpdateLink(row.linkId, "APPROVED")}
                      className="border border-emerald-200 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg font-semibold px-2.5 py-1 text-xs transition"
                    >
                      Approve
                    </button>
                  ) : null}
                  {row.status !== "REMOVED" ? (
                    <button
                      type="button"
                      onClick={() => onUpdateLink(row.linkId, "REMOVED")}
                      className="border border-rose-200 bg-rose-50/30 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg font-semibold px-2.5 py-1 text-xs transition"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </Td>
            </tr>
          );
        })}
        {!rows?.length ? <EmptyRow colSpan={7} label="No customers match this view." /> : null}
      </tbody>
    </Table>
  );
}

function InvoicesTable({ rows }: { rows: ChannelPartnerInvoicePayload[] }) {
  return (
    <Table>
      <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <Th>Invoice</Th>
          <Th>Customer / Party</Th>
          <Th>Vehicle</Th>
          <Th>Date</Th>
          <Th>Payment</Th>
          <Th>Premium</Th>
          <Th>PDFs</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
            <Td>
              <p className="font-semibold text-slate-950">{row.invoiceNumber}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.productName || "-"}</p>
            </Td>
            <Td className="text-slate-700">{row.billToName || row.insuredPersonNameSnapshot || row.shipToName || "-"}</Td>
            <Td className="text-slate-600 font-mono text-xs">{row.vehicleNumber || "-"}</Td>
            <Td>{formatDate(row.invoiceDate)}</Td>
            <Td><StatusPill status={row.paymentStatus} /></Td>
            <Td className="font-semibold text-slate-900">{formatCurrency(row.premiumAmount)}</Td>
            <Td>
              <div className="flex gap-3 text-xs font-semibold">
                {row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Invoice</a> : null}
                {row.insuranceUrl ? <a href={row.insuranceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Policy</a> : null}
                {!row.pdfUrl && !row.insuranceUrl ? "-" : null}
              </div>
            </Td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={7} label="No invoices match this view." /> : null}
      </tbody>
    </Table>
  );
}

function CommissionsTable({ rows }: { rows: ChannelPartnerCommissionPayload[] }) {
  return (
    <Table>
      <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <Th>Invoice</Th>
          <Th>Customer</Th>
          <Th>Status</Th>
          <Th>Premium</Th>
          <Th>Rate</Th>
          <Th>Commission</Th>
          <Th>Paid At</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
            <Td>
              <p className="font-semibold text-slate-950">{row.invoiceNumber || row.invoiceId}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(row.invoiceDate)}</p>
            </Td>
            <Td>
              <p className="font-semibold text-slate-900">{row.customer?.name || "-"}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.customer?.mobileNumber || ""}</p>
            </Td>
            <Td><StatusPill status={row.status} /></Td>
            <Td className="text-slate-600">{formatCurrency(row.premiumAmount)}</Td>
            <Td className="text-slate-600 font-semibold">{(Number(row.commissionRate || 0) * 100).toFixed(0)}%</Td>
            <Td className="font-bold text-slate-900">{formatCurrency(row.commissionAmount)}</Td>
            <Td className="text-slate-500">{formatDate(row.paidAt)}</Td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={7} label="No commission rows match this view." /> : null}
      </tbody>
    </Table>
  );
}

function TrackingTable({ rows }: { rows: ChannelPartnerTripPayload[] }) {
  return (
    <Table>
      <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <Th>Vehicle</Th>
          <Th>Invoice</Th>
          <Th>Route</Th>
          <Th>Status</Th>
          <Th>Last Location</Th>
          <Th>Updated</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
            <Td className="font-semibold text-slate-900">{row.vehicleNumber || "Vehicle pending"}</Td>
            <Td className="text-slate-600 font-semibold">{row.invoice?.invoiceNumber || "-"}</Td>
            <Td className="text-slate-700">
              {row.src || "-"} <span className="text-slate-400 mx-1">→</span> {row.dest || "-"}
            </Td>
            <Td><StatusPill status={row.status} /></Td>
            <Td className="max-w-md truncate text-slate-500">{row.lastLocation?.address || "Latest location unavailable"}</Td>
            <Td className="text-slate-500">{formatDate(row.updatedAt)}</Td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={6} label="No trips match this view." /> : null}
      </tbody>
    </Table>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table className="min-w-full divide-y divide-slate-200/80 text-sm">{children}</table>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3.5 font-bold">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-slate-700 ${className}`}>{children}</td>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm font-semibold text-slate-400">
        {label}
      </td>
    </tr>
  );
}
