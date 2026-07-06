"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BadgeIndianRupee,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
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
  ChannelPartnerSummary,
  adminApi,
} from "@/features/admin/api/admin.api";

type TabKey = "customers" | "invoices" | "commissions" | "tracking";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "tracking", label: "Tracking" },
];
const TAB_PAGE_SIZE = 50;
const INVOICE_TAB_PAGE_SIZE = 20;
const INVOICE_STATUS_OPTIONS = ["NOT_REQUIRED", "PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"];
const COMMISSION_STATUS_OPTIONS = ["PENDING", "PAYABLE", "PAID", "VOID"];
const TRACKING_STATUS_OPTIONS = ["PENDING", "ACTIVE", "IN_PROGRESS", "ENDED"];

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
  const [userResults, setUserResults] = useState<AdminLedgerUser[]>([]);
  const [assigningUserId, setAssigningUserId] = useState("");

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

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    const response = await adminApi.searchUsers(userSearch, 10);
    if (response.success) {
      setUserResults(response.data ?? []);
    } else {
      toast.error(response.message ?? "Failed to search users");
    }
  };

  const assignCustomer = async () => {
    if (!selectedPartner?.id || !assigningUserId) return;
    const response = await adminApi.addChannelPartnerCustomer(selectedPartner.id, assigningUserId);
    if (!response.success) {
      toast.error(response.message ?? "Failed to assign customer");
      return;
    }
    toast.success("Customer assigned successfully");
    setAssigningUserId("");
    setUserSearch("");
    setUserResults([]);
    void Promise.all([loadProfile(), loadSummary()]);
    void loadCustomerStats();
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
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Code: <span className="text-slate-700">{selectedPartner?.code || "-"}</span>
              </p>
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
          <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 transition-opacity duration-200 ${loadingSummary ? 'opacity-65' : ''}`}>
            <Metric icon={Users} label="Customers" value={String(dynamicSummary.customers)} color="blue" />
            <Metric icon={FileText} label="Invoices" value={String(dynamicSummary.invoices)} color="slate" />
            <Metric icon={BadgeIndianRupee} label="Premium Total" value={formatCurrency(dynamicSummary.premiumTotal)} color="emerald" />
            <Metric icon={BadgeIndianRupee} label="Pending Comm." value={formatCurrency(dynamicSummary.commissionPending)} color="amber" />
            <Metric icon={BadgeIndianRupee} label="Payable Comm." value={formatCurrency(dynamicSummary.commissionPayable)} color="indigo" />
            <Metric icon={MapPin} label="Active Trips" value={String(dynamicSummary.activeTrips)} color="violet" />
          </div>

          {/* Customer Assignment Panel */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Assign Customer to Partner</h3>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchUsers();
                  }}
                  placeholder="Search user by name or mobile number..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => void searchUsers()}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => void assignCustomer()}
                disabled={!assigningUserId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition"
              >
                <UserPlus className="h-4 w-4" />
                Assign User
              </button>
            </div>
            {userResults.length ? (
              <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 lg:grid-cols-3">
                {userResults.map((user) => (
                  <label
                    key={user.id}
                    className={`cursor-pointer rounded-xl border p-3 text-sm transition flex items-center ${
                      assigningUserId === user.id
                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="customerUserId"
                      checked={assigningUserId === user.id}
                      onChange={() => setAssigningUserId(user.id)}
                      className="mr-3 text-blue-600 focus:ring-blue-400"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{user.mobileNumber}</p>
                    </div>
                  </label>
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
