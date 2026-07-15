"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  BadgeIndianRupee,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  Users,
  UserPlus,
  X,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Route,
} from "lucide-react";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { ChannelPartnerDetailPayload } from "@/features/admin/api/admin.api";
import { getMyChannelPartnerDashboard, onboardChannelPartnerCustomer } from "./api";

type PartnerTab = "customers" | "invoices" | "commissions" | "tracking";

const partnerTabs: Array<{ key: PartnerTab; label: string }> = [
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "tracking", label: "Tracking & Trips" },
];

const indianStates = [
  { value: "ANDHRA_PRADESH", label: "Andhra Pradesh" },
  { value: "ARUNACHAL_PRADESH", label: "Arunachal Pradesh" },
  { value: "ASSAM", label: "Assam" },
  { value: "BIHAR", label: "Bihar" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  { value: "GOA", label: "Goa" },
  { value: "GUJARAT", label: "Gujarat" },
  { value: "HARYANA", label: "Haryana" },
  { value: "HIMACHAL_PRADESH", label: "Himachal Pradesh" },
  { value: "JHARKHAND", label: "Jharkhand" },
  { value: "KARNATAKA", label: "Karnataka" },
  { value: "KERALA", label: "Kerala" },
  { value: "MADHYA_PRADESH", label: "Madhya Pradesh" },
  { value: "MAHARASHTRA", label: "Maharashtra" },
  { value: "MANIPUR", label: "Manipur" },
  { value: "MEGHALAYA", label: "Meghalaya" },
  { value: "MIZORAM", label: "Mizoram" },
  { value: "NAGALAND", label: "Nagaland" },
  { value: "ODISHA", label: "Odisha" },
  { value: "PUNJAB", label: "Punjab" },
  { value: "RAJASTHAN", label: "Rajasthan" },
  { value: "SIKKIM", label: "Sikkim" },
  { value: "TAMIL_NADU", label: "Tamil Nadu" },
  { value: "TELANGANA", label: "Telangana" },
  { value: "TRIPURA", label: "Tripura" },
  { value: "UTTAR_PRADESH", label: "Uttar Pradesh" },
  { value: "UTTARAKHAND", label: "Uttarakhand" },
  { value: "WEST_BENGAL", label: "West Bengal" },
  { value: "DELHI", label: "Delhi" },
];

const customerIdentities = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "BUYER", label: "Buyer" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "AGENT", label: "Agent" },
];

const commonCommodities = [
  "Tomato", "Potato", "Onion", "Garlic", "Ginger", "Lemon", "Apple", "Banana", 
  "Mango", "Tender Coconut", "Pineapple", "Mosambi", "Coconut", "Paddy", "Wheat", "Rice"
];

const INVOICE_PAGE_SIZE = 20;
const TAB_PAGE_SIZE = 50;

const EMPTY_CUSTOMER_STATS = {
  invoices: 0,
  premiumTotal: 0,
  pendingPayments: 0,
  activeTrips: 0,
  lastInvoiceDate: null,
};

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
  if (norm === "PAID" || norm === "PAYABLE" || norm === "ACTIVE" || norm === "APPROVED" || norm === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (norm === "PENDING" || norm === "PARTIAL" || norm === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (norm === "SUSPENDED" || norm === "VOID" || norm === "FAILED" || norm === "REJECTED" || norm === "CANCELLED") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function searchable(value: unknown) {
  return String(value || "").toLowerCase();
}

function isRequestCanceled(error: unknown) {
  if (error == null || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: string };
  return candidate.name === "AbortError" || candidate.name === "CanceledError" || candidate.code === "ERR_CANCELED";
}

function firstReadable(...values: Array<string | null | undefined>) {
  return values.find((value) => {
    const trimmed = String(value || "").trim();
    return trimmed && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed);
  }) || "";
}

function parseDistanceKm(value?: string | number | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const match = String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function tripProgress(row: NonNullable<ChannelPartnerDetailPayload["trips"]>[number]) {
  const traveled = parseDistanceKm(row.lastLocation?.distanceTravel);
  const total = parseDistanceKm(row.lastLocation?.totalDistance);
  if (traveled !== null && total && total > 0) {
    return Math.max(0, Math.min(100, Math.round((traveled / total) * 100)));
  }

  const remaining = parseDistanceKm(row.lastLocation?.distanceRemained);
  if (remaining !== null && total && total > 0) {
    return Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
  }

  const status = String(row.status || "").toUpperCase();
  if (status === "ENDED" || status === "COMPLETED") return 100;
  if (status === "ACTIVE" || status === "IN_PROGRESS") return 50;
  return 0;
}

function formatProgressLabel(row: NonNullable<ChannelPartnerDetailPayload["trips"]>[number]) {
  const progress = tripProgress(row);
  const remaining = row.lastLocation?.distanceRemained;
  const time = row.lastLocation?.timeRemained;
  const detail = [remaining ? `${remaining} left` : "", time ? `${time}` : ""].filter(Boolean).join(" · ");
  return { progress, detail };
}

export default function ChannelPartnerDashboardPage() {
  const { user, logout } = useAuth();
  const [payload, setPayload] = useState<ChannelPartnerDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<PartnerTab>("customers");
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState("");
  const [customerStats, setCustomerStats] = useState<NonNullable<ChannelPartnerDetailPayload["customerStats"]>>({});
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionsTotal, setCommissionsTotal] = useState(0);
  const [commissionsTotalPages, setCommissionsTotalPages] = useState(1);
  const [tripsPage, setTripsPage] = useState(1);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [tripsTotalPages, setTripsTotalPages] = useState(1);
  const profileRequestRef = useRef<AbortController | null>(null);
  const summaryRequestRef = useRef<AbortController | null>(null);
  const customerStatsRequestRef = useRef<AbortController | null>(null);
  const tabRequestRef = useRef<AbortController | null>(null);

  // Onboarding Modal States
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    name: "",
    mobileNumber: "",
    secondaryMobileNumber: "",
    state: "MAHARASHTRA",
    mandiName: "",
    identity: "CUSTOMER",
    products: [] as string[],
  });
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    profileRequestRef.current?.abort();
    const controller = new AbortController();
    profileRequestRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const response = await getMyChannelPartnerDashboard({ scope: "profile" }, { signal: controller.signal });
      setPayload((current) => ({
        ...response,
        summary: current?.summary || response.summary,
        customers: response.customers || [],
        invoices: current?.invoices || [],
        commissions: current?.commissions || [],
        trips: current?.trips || [],
      }));
    } catch (err: unknown) {
      if (isRequestCanceled(err)) return;
      const message =
        err instanceof Error ? err.message : "Failed to load channel partner dashboard";
      setError(message);
      setPayload(null);
    } finally {
      if (profileRequestRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  const loadSummary = useCallback(async () => {
    summaryRequestRef.current?.abort();
    const controller = new AbortController();
    summaryRequestRef.current = controller;

    setSummaryLoading(true);
    try {
      const response = await getMyChannelPartnerDashboard({ scope: "summary" }, { signal: controller.signal });
      setPayload((current) => current ? { ...current, summary: response.summary || current.summary } : {
        profile: response.profile || null,
        summary: response.summary,
        customers: [],
        invoices: [],
        commissions: [],
        trips: [],
        message: response.message,
      });
    } catch (err: unknown) {
      if (!isRequestCanceled(err)) {
        toast.error(err instanceof Error ? err.message : "Failed to load partner summary");
      }
    } finally {
      if (summaryRequestRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  }, []);

  const loadCustomerStats = useCallback(async () => {
    customerStatsRequestRef.current?.abort();
    const controller = new AbortController();
    customerStatsRequestRef.current = controller;

    try {
      const response = await getMyChannelPartnerDashboard({ scope: "customer-stats" }, { signal: controller.signal });
      setCustomerStats(response.customerStats || {});
    } catch (err: unknown) {
      if (!isRequestCanceled(err)) {
        toast.error(err instanceof Error ? err.message : "Failed to load customer stats");
      }
    }
  }, []);

  const loadTabData = useCallback(async (tab: PartnerTab, page = 1) => {
    if (tab === "customers") return;

    tabRequestRef.current?.abort();
    const controller = new AbortController();
    tabRequestRef.current = controller;

    setTableLoading(true);
    try {
      const response = await getMyChannelPartnerDashboard(
        {
          scope: tab === "tracking" ? "trips" : tab,
          page,
          limit: tab === "invoices" ? INVOICE_PAGE_SIZE : TAB_PAGE_SIZE,
          invoiceSearch: tab === "invoices" && debouncedInvoiceSearch ? debouncedInvoiceSearch : undefined,
        },
        { signal: controller.signal },
      );

      setPayload((current) => {
        if (!current) return current;
        if (tab === "invoices") return { ...current, invoices: response.invoices || [] };
        if (tab === "commissions") return { ...current, commissions: response.commissions || [] };
        return { ...current, trips: response.trips || [] };
      });

      const total = response.total || 0;
      const totalPages = Math.max(1, Number(response.totalPages || 0) || 1);
      const safePage = response.page || page;
      if (tab === "invoices") {
        setInvoicesTotal(total);
        setInvoicesTotalPages(totalPages);
        setInvoicesPage(safePage);
      } else if (tab === "commissions") {
        setCommissionsTotal(total);
        setCommissionsTotalPages(totalPages);
        setCommissionsPage(safePage);
      } else {
        setTripsTotal(total);
        setTripsTotalPages(totalPages);
        setTripsPage(safePage);
      }
    } catch (err: unknown) {
      if (!isRequestCanceled(err)) {
        toast.error(err instanceof Error ? err.message : `Failed to load ${tab}`);
      }
    } finally {
      if (tabRequestRef.current === controller) {
        setTableLoading(false);
      }
    }
  }, [debouncedInvoiceSearch]);

  const loadDashboard = useCallback(async () => {
    await Promise.all([loadProfile(), loadSummary()]);
    if (activeTab === "customers") {
      await loadCustomerStats();
    } else {
      await loadTabData(activeTab, 1);
    }
  }, [activeTab, loadCustomerStats, loadProfile, loadSummary, loadTabData]);

  useEffect(() => {
    void Promise.all([loadProfile(), loadSummary()]);
  }, [loadProfile, loadSummary]);

  useEffect(() => {
    if (activeTab !== "invoices") {
      setDebouncedInvoiceSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedInvoiceSearch(tableSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [activeTab, tableSearch]);

  useEffect(() => {
    if (!payload?.profile) return;
    if (activeTab === "customers") {
      tabRequestRef.current?.abort();
      setTableLoading(false);
      void loadCustomerStats();
      return;
    }
    void loadTabData(activeTab, 1);
  }, [activeTab, loadCustomerStats, loadTabData, payload?.profile]);

  useEffect(() => {
    return () => {
      profileRequestRef.current?.abort();
      summaryRequestRef.current?.abort();
      customerStatsRequestRef.current?.abort();
      tabRequestRef.current?.abort();
    };
  }, []);

  const summary = payload?.summary;
  const statItems = useMemo(
    () => [
      { label: "Customers", value: String(summary?.customers ?? 0), icon: Users },
      { label: "Invoices", value: String(summary?.invoices ?? 0), icon: FileText },
      { label: "Premium Total", value: formatCurrency(summary?.premiumTotal ?? 0), icon: BadgeIndianRupee },
      {
        label: "Pending Commission",
        value: formatCurrency(summary?.commissionPending ?? 0),
        icon: BadgeIndianRupee,
      },
      {
        label: "Payable Commission",
        value: formatCurrency(summary?.commissionPayable ?? 0),
        icon: BadgeIndianRupee,
      },
      { label: "Active Trips", value: String(summary?.activeTrips ?? 0), icon: MapPin },
    ],
    [summary],
  );

  const q = tableSearch.trim().toLowerCase();
  const customerRows = useMemo(() => {
    const rows = (payload?.customers || []).map((row) => ({
      ...row,
      stats: row.stats || customerStats[row.customer.id] || EMPTY_CUSTOMER_STATS,
    }));
    if (!q) return rows;
    return rows.filter((row) =>
      [row.customer.name, row.customer.mobileNumber, row.customer.identity].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [customerStats, payload?.customers, q]);

  const invoiceRows = useMemo(() => {
    const rows = payload?.invoices || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.invoiceNumber, row.billToName, row.shipToName, row.vehicleNumber, row.paymentStatus].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.invoices, q]);

  const commissionRows = useMemo(() => {
    const rows = payload?.commissions || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.invoiceNumber, row.customer?.name, row.customer?.mobileNumber, row.status].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.commissions, q]);

  const tripRows = useMemo(() => {
    const rows = payload?.trips || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.vehicleNumber, row.invoice?.invoiceNumber, row.src, row.dest, row.status, row.lastLocation?.address].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.trips, q]);

  // Handle onboarding form changes
  const toggleCommodity = (commodity: string) => {
    setOnboardForm((prev) => {
      const exists = prev.products.includes(commodity);
      const nextProducts = exists
        ? prev.products.filter((p) => p !== commodity)
        : [...prev.products, commodity];
      return { ...prev, products: nextProducts };
    });
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!onboardForm.mobileNumber.trim()) {
      toast.error("Customer mobile number is required");
      return;
    }

    setOnboardingBusy(true);
    try {
      const response = await onboardCustomerCustomerData();
      if (response.success) {
        const status = String(response.data?.status || "").toUpperCase();
        toast.success(
          response.message ||
            (status === "PENDING"
              ? "Customer already exists. Sent to admin for approval."
              : "Customer onboarded successfully"),
        );
        setIsOnboardingOpen(false);
        setOnboardForm({
          name: "",
          mobileNumber: "",
          secondaryMobileNumber: "",
          state: "MAHARASHTRA",
          mandiName: "",
          identity: "CUSTOMER",
          products: [],
        });
        await loadDashboard();
      } else {
        toast.error(response.message || "Failed to onboard customer");
      }
    } catch (err: unknown) {
      const candidate = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(candidate.response?.data?.message || candidate.message || "Failed to onboard customer");
    } finally {
      setOnboardingBusy(false);
    }
  };

  const onboardCustomerCustomerData = async () => {
    return await onboardChannelPartnerCustomer({
      name: onboardForm.name,
      mobileNumber: onboardForm.mobileNumber,
      secondaryMobileNumber: onboardForm.secondaryMobileNumber || undefined,
      state: onboardForm.state,
      mandiName: onboardForm.mandiName || undefined,
      products: onboardForm.products,
      identity: onboardForm.identity,
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xl shadow-md">
                M+
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Channel Partner Dashboard
                </p>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {payload?.profile?.partnerUser?.name || user?.name || "Partner"}
                </h1>
                {payload?.profile ? (
                  <p className="text-xs text-slate-500">
                    Code <span className="font-semibold text-slate-700">{payload.profile.code}</span> ·{" "}
                    <span className="font-semibold text-slate-700">{(payload.profile.commissionRate * 100).toFixed(0)}%</span> commission
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <UserPlus className="h-4 w-4" />
                Onboard Customer
              </button>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                title="Refresh Page"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Main Content */}
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-sm font-semibold text-slate-400">Loading partner analytics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 shadow-sm">
              {error}
            </div>
          ) : payload?.message ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <p className="text-sm font-semibold text-amber-900">{payload.message}</p>
              <p className="mt-1 text-sm text-amber-800">
                Your normal MandiPlus account still works. Channel partner access is an addon.
              </p>
              <Link
                href="/home"
                className="mt-4 inline-flex rounded-md bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800"
              >
                Go to Home
              </Link>
            </div>
          ) : (
            <>
              {/* Analytics Blocks */}
              <section className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 ${summaryLoading ? "opacity-70" : ""}`}>
                {statItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                      <item.icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 text-lg font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </section>

              {/* Lists and Data Segment */}
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                    {partnerTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.key);
                          setTableSearch("");
                        }}
                        className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                          activeTab === tab.key
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex min-w-[16rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={tableSearch}
                      onChange={(event) => setTableSearch(event.target.value)}
                      placeholder={`Search ${activeTab}...`}
                      className="w-full bg-transparent text-sm outline-none text-slate-700"
                    />
                  </div>
                </div>

                {/* Minimalist Data Tables */}
                <div className="relative">
                  {tableLoading ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  ) : null}
                  <div className={`max-h-[520px] overflow-auto ${tableLoading ? "opacity-50" : ""}`}>
                    {activeTab === "customers" ? (
                      <PartnerCustomers rows={customerRows} />
                    ) : activeTab === "invoices" ? (
                      <PartnerInvoices rows={invoiceRows} />
                    ) : activeTab === "commissions" ? (
                      <PartnerCommissions rows={commissionRows} />
                    ) : (
                      <PartnerTrips rows={tripRows} />
                    )}
                  </div>
                  {activeTab === "invoices" ? (
                    <PaginationFooter
                      label="invoices"
                      page={invoicesPage}
                      total={invoicesTotal}
                      totalPages={invoicesTotalPages}
                      visibleCount={invoiceRows.length}
                      busy={tableLoading}
                      onPageChange={(page) => void loadTabData("invoices", page)}
                    />
                  ) : activeTab === "commissions" ? (
                    <PaginationFooter
                      label="commissions"
                      page={commissionsPage}
                      total={commissionsTotal}
                      totalPages={commissionsTotalPages}
                      visibleCount={commissionRows.length}
                      busy={tableLoading}
                      onPageChange={(page) => void loadTabData("commissions", page)}
                    />
                  ) : activeTab === "tracking" ? (
                    <PaginationFooter
                      label="trips"
                      page={tripsPage}
                      total={tripsTotal}
                      totalPages={tripsTotalPages}
                      visibleCount={tripRows.length}
                      busy={tableLoading}
                      onPageChange={(page) => void loadTabData("tracking", page)}
                    />
                  ) : null}
                </div>
              </section>
            </>
          )}
        </main>

        {/* Onboarding Sliding / Centered Modal */}
        {isOnboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden transition-all">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-900">Onboard New Customer</h2>
                </div>
                <button
                  onClick={() => setIsOnboardingOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleOnboardSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                      placeholder="e.g. Laxman Tomato Traders"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>

                  {/* Identity */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Customer Type *
                    </label>
                    <select
                      value={onboardForm.identity}
                      onChange={(e) => setOnboardForm({ ...onboardForm, identity: e.target.value })}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    >
                      {customerIdentities.map((id) => (
                        <option key={id.value} value={id.value}>{id.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.mobileNumber}
                      onChange={(e) => setOnboardForm({ ...onboardForm, mobileNumber: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>

                  {/* Secondary Mobile */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Secondary Mobile (Optional)
                    </label>
                    <input
                      type="text"
                      value={onboardForm.secondaryMobileNumber}
                      onChange={(e) => setOnboardForm({ ...onboardForm, secondaryMobileNumber: e.target.value })}
                      placeholder="e.g. 9022353647"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Location State *
                    </label>
                    <select
                      value={onboardForm.state}
                      onChange={(e) => setOnboardForm({ ...onboardForm, state: e.target.value })}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    >
                      {indianStates.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mandi Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Mandi Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={onboardForm.mandiName}
                      onChange={(e) => setOnboardForm({ ...onboardForm, mandiName: e.target.value })}
                      placeholder="e.g. Pimpalgaon Mandi"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Commodities (Multi-Select Grid) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Select Commodities Traded (Multi-Select)
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-48 overflow-y-auto border border-slate-100 rounded-md p-3">
                    {commonCommodities.map((item) => {
                      const isSelected = onboardForm.products.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleCommodity(item)}
                          className={`rounded px-3 py-1.5 text-xs font-semibold text-center border transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(false)}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboardingBusy}
                    className="rounded-md bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {onboardingBusy ? "Onboarding Customer..." : "Onboard Customer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// Minimalist Tab Lists

function PartnerCustomers({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["customers"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Customer</th>
          <th className="px-4 py-3">Identity</th>
          <th className="px-4 py-3">Invoices</th>
          <th className="px-4 py-3">Premium Amount</th>
          <th className="px-4 py-3">Last Active Invoice</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.linkId} className="hover:bg-slate-50 transition">
            <td className="px-4 py-3">
              <p className="font-semibold text-slate-900">{row.customer.name}</p>
              <p className="text-xs text-slate-500">{row.customer.mobileNumber}</p>
            </td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(row.customer.identity)}`}>
                {row.customer.identity || "CUSTOMER"}
              </span>
            </td>
            <td className="px-4 py-3 font-semibold text-slate-700">{row.stats.invoices}</td>
            <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(row.stats.premiumTotal)}</td>
            <td className="px-4 py-3 text-slate-500">{formatDate(row.stats.lastInvoiceDate)}</td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={5} label="No customers linked yet." /> : null}
      </tbody>
    </table>
  );
}

function PartnerInvoices({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["invoices"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Invoice Number</th>
          <th className="px-4 py-3">Billed Party</th>
          <th className="px-4 py-3">Vehicle</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Premium Amount</th>
          <th className="px-4 py-3">Links</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50 transition">
            <td className="px-4 py-3">
              <p className="font-semibold text-slate-900">{row.invoiceNumber}</p>
              <p className="text-xs text-slate-500">{formatDate(row.invoiceDate)}</p>
            </td>
            <td className="px-4 py-3 text-slate-600">{row.billToName || row.insuredPersonNameSnapshot || row.shipToName || "-"}</td>
            <td className="px-4 py-3 text-slate-600 font-mono text-xs">{row.vehicleNumber || "-"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(row.paymentStatus)}`}>
                {row.paymentStatus}
              </span>
            </td>
            <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(row.premiumAmount)}</td>
            <td className="px-4 py-3">
              <div className="flex gap-2 text-xs font-semibold">
                {row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Invoice</a> : null}
                {row.insuranceUrl ? <a href={row.insuranceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Policy</a> : null}
                {!row.pdfUrl && !row.insuranceUrl ? "-" : null}
              </div>
            </td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={6} label="No customer invoices processed." /> : null}
      </tbody>
    </table>
  );
}

function PartnerCommissions({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["commissions"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Invoice Number</th>
          <th className="px-4 py-3">Customer</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Premium</th>
          <th className="px-4 py-3">Commission Earned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50 transition">
            <td className="px-4 py-3">
              <p className="font-semibold text-slate-900">{row.invoiceNumber || row.invoiceId}</p>
              <p className="text-xs text-slate-500">{formatDate(row.invoiceDate)}</p>
            </td>
            <td className="px-4 py-3 text-slate-600">{row.customer?.name || "-"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(row.status)}`}>
                {row.status}
              </span>
            </td>
            <td className="px-4 py-3 text-slate-600">{formatCurrency(row.premiumAmount)}</td>
            <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(row.commissionAmount)}</td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={5} label="No commissions generated yet." /> : null}
      </tbody>
    </table>
  );
}

function PartnerTrips({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["trips"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Vehicle</th>
          <th className="px-4 py-3">Route</th>
          <th className="px-4 py-3">Trip Progress</th>
          <th className="px-4 py-3">Current Location</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => {
          const source = firstReadable(row.sourceName, row.src) || "Source pending";
          const destination = firstReadable(row.destinationName, row.dest) || "Destination pending";
          const { progress, detail } = formatProgressLabel(row);
          return (
            <tr key={row.id} className="hover:bg-slate-50 transition">
              <td className="px-4 py-4">
                <p className="font-semibold text-slate-900">{row.vehicleNumber || "Vehicle pending"}</p>
                <p className="text-xs text-slate-500">{row.invoice?.invoiceNumber || "Invoice pending"}</p>
              </td>
              <td className="px-4 py-4 min-w-[18rem]">
                <div className="flex items-start gap-2">
                  <Route className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-800">{source}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">to {destination}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 min-w-[14rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
              </td>
              <td className="px-4 py-4 max-w-sm">
                <p className="truncate font-medium text-slate-700">{row.lastLocation?.address || "Current location pending"}</p>
                {row.lastLocation?.timeRecorded ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(row.lastLocation.timeRecorded)}
                  </p>
                ) : null}
              </td>
            </tr>
          );
        })}
        {!rows.length ? <EmptyRow colSpan={4} label="No active tracking shipments." /> : null}
      </tbody>
    </table>
  );
}

function PaginationFooter({
  label,
  page,
  total,
  totalPages,
  visibleCount,
  busy,
  onPageChange,
}: {
  label: string;
  page: number;
  total: number;
  totalPages: number;
  visibleCount: number;
  busy: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1 && total <= visibleCount) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <span className="text-xs font-semibold text-slate-500">
        Showing {visibleCount} of {total} {label} · Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label={`Previous ${label} page`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={busy || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label={`Next ${label} page`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
        {label}
      </td>
    </tr>
  );
}
