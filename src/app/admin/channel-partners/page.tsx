"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  BadgeIndianRupee,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Route,
} from "lucide-react";
import {
  AdminChannelPartnerListRow,
  AdminLedgerUser,
  ChannelPartnerCommissionPayload,
  ChannelPartnerDetailPayload,
  ChannelPartnerInvoicePayload,
  ChannelPartnerSummary,
  ChannelPartnerStatus,
  ChannelPartnerTripPayload,
  adminApi,
} from "@/features/admin/api/admin.api";
import { useAdmin } from "@/features/admin/context/AdminContext";

type TabKey = "customers" | "invoices" | "commissions" | "tracking";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "tracking", label: "Tracking" },
];
const INVOICE_STATUS_OPTIONS = ["NOT_REQUIRED", "PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"];
const COMMISSION_STATUS_OPTIONS = ["PENDING", "PAYABLE", "PAID", "VOID"];
const TRACKING_STATUS_OPTIONS = ["PENDING", "ACTIVE", "IN_PROGRESS", "ENDED"];
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

function pillClass(status?: string | null) {
  if (status === "ACTIVE" || status === "APPROVED" || status === "PAYABLE" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "PENDING" || status === "PARTIAL") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "SUSPENDED" || status === "REMOVED" || status === "VOID" || status === "REJECTED") {
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

function tripProgress(row: ChannelPartnerTripPayload) {
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

function tripProgressDetail(row: ChannelPartnerTripPayload) {
  return [
    row.lastLocation?.distanceRemained ? `${row.lastLocation.distanceRemained} left` : "",
    row.lastLocation?.timeRemained || "",
  ].filter(Boolean).join(" · ");
}

export default function AdminChannelPartnersPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();
  const [partners, setPartners] = useState<AdminChannelPartnerListRow[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [detail, setDetail] = useState<ChannelPartnerDetailPayload | null>(null);
  const [customerStats, setCustomerStats] = useState<NonNullable<ChannelPartnerDetailPayload["customerStats"]>>({});
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("customers");
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedTableSearch, setDebouncedTableSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("ALL");
  const [trackingStatusFilter, setTrackingStatusFilter] = useState("ALL");
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionsTotal, setCommissionsTotal] = useState(0);
  const [commissionsTotalPages, setCommissionsTotalPages] = useState(1);
  const [tripsPage, setTripsPage] = useState(1);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [tripsTotalPages, setTripsTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<AdminLedgerUser[]>([]);
  const [assigningUserId, setAssigningUserId] = useState("");
  const profileRequestRef = useRef<AbortController | null>(null);
  const summaryRequestRef = useRef<AbortController | null>(null);
  const customerStatsRequestRef = useRef<AbortController | null>(null);
  const tabRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/admin/login");
  }, [loading, isAuthenticated, router]);

  const loadPartners = useCallback(async () => {
    setBusy(true);
    const response = await adminApi.getChannelPartners();
    if (response.success) {
      const rows = response.data || [];
      setPartners(rows);
      setSelectedPartnerId((current) => current || rows[0]?.id || "");
    } else {
      toast.error(response.message || "Failed to load channel partners");
    }
    setBusy(false);
  }, []);

  const primePartnerDetail = useCallback((partner?: AdminChannelPartnerListRow | null) => {
    if (!partner) {
      setDetail(null);
      return;
    }
    setDetail({
      profile: partner,
      summary: partner.summary,
      customers: [],
      invoices: [],
      commissions: [],
      trips: [],
    });
  }, []);

  const loadProfile = useCallback(async (partnerId: string) => {
    if (!partnerId) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();
    profileRequestRef.current?.abort();
    profileRequestRef.current = controller;

    try {
      const response = await adminApi.getChannelPartnerDetail(
        partnerId,
        { scope: "profile" },
        { signal: controller.signal },
      );
      if (response.success) {
        setDetail((current) => ({
          profile: response.data?.profile || current?.profile || null,
          summary: current?.summary,
          customers: response.data?.customers || [],
          invoices: current?.invoices || [],
          commissions: current?.commissions || [],
          trips: current?.trips || [],
        }));
      } else {
        toast.error(response.message || "Failed to load partner profile");
      }
    } catch (error) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message || "Failed to load partner profile");
      }
    }
  }, []);

  const loadSummary = useCallback(async (partnerId: string) => {
    if (!partnerId) return;

    const controller = new AbortController();
    summaryRequestRef.current?.abort();
    summaryRequestRef.current = controller;

    setSummaryBusy(true);
    try {
      const response = await adminApi.getChannelPartnerDetail(
        partnerId,
        { scope: "summary" },
        { signal: controller.signal },
      );
      if (response.success) {
        setDetail((current) => current ? { ...current, summary: response.data?.summary || current.summary } : current);
      } else {
        toast.error(response.message || "Failed to load partner summary");
      }
    } catch (error) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message || "Failed to load partner summary");
      }
    } finally {
      if (summaryRequestRef.current === controller) {
        setSummaryBusy(false);
      }
    }
  }, []);

  const loadCustomerStats = useCallback(async (partnerId: string) => {
    if (!partnerId) return;

    const controller = new AbortController();
    customerStatsRequestRef.current?.abort();
    customerStatsRequestRef.current = controller;

    try {
      const response = await adminApi.getChannelPartnerDetail(
        partnerId,
        { scope: "customer-stats" },
        { signal: controller.signal },
      );
      if (response.success) {
        setCustomerStats(response.data?.customerStats || {});
      } else {
        toast.error(response.message || "Failed to load customer stats");
      }
    } catch (error) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message || "Failed to load customer stats");
      }
    }
  }, []);

  const loadTabData = useCallback(async (partnerId: string, tab: TabKey, page = 1) => {
    if (!partnerId || tab === "customers") return;

    const controller = new AbortController();
    tabRequestRef.current?.abort();
    tabRequestRef.current = controller;

    const filters: Parameters<typeof adminApi.getChannelPartnerDetail>[1] = {
      scope: tab === "tracking" ? "trips" : tab,
      page,
      limit: tab === "invoices" ? INVOICE_PAGE_SIZE : TAB_PAGE_SIZE,
    };
    if (tab === "invoices" && invoiceStatusFilter !== "ALL") filters.status = invoiceStatusFilter;
    if (tab === "invoices" && debouncedTableSearch.trim()) filters.invoiceSearch = debouncedTableSearch.trim();
    if (tab === "commissions" && commissionStatusFilter !== "ALL") filters.status = commissionStatusFilter;
    if (tab === "tracking" && trackingStatusFilter !== "ALL") filters.status = trackingStatusFilter;

    setDetailBusy(true);
    try {
      const response = await adminApi.getChannelPartnerDetail(partnerId, filters, { signal: controller.signal });
      if (!response.success) {
        toast.error(response.message || `Failed to load ${tab}`);
        return;
      }

      setDetail((current) => {
        if (!current) return current;
        if (tab === "invoices") return { ...current, invoices: response.data?.invoices || [] };
        if (tab === "commissions") return { ...current, commissions: response.data?.commissions || [] };
        return { ...current, trips: response.data?.trips || [] };
      });

      const total = response.data?.total || 0;
      const totalPages = Math.max(1, Number(response.data?.totalPages || 0) || 1);
      const safePage = response.data?.page || page;
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
    } catch (error) {
      if (!isRequestCanceled(error)) {
        toast.error((error as { message?: string })?.message || `Failed to load ${tab}`);
      }
    } finally {
      if (tabRequestRef.current === controller) {
        setDetailBusy(false);
      }
    }
  }, [commissionStatusFilter, debouncedTableSearch, invoiceStatusFilter, trackingStatusFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadPartners();
  }, [isAuthenticated, loadPartners]);

  useEffect(() => {
    if (activeTab !== "invoices") {
      setDebouncedTableSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedTableSearch(tableSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [activeTab, tableSearch]);

  useEffect(() => {
    if (!selectedPartnerId) {
      setDetail(null);
      return;
    }
    profileRequestRef.current?.abort();
    summaryRequestRef.current?.abort();
    customerStatsRequestRef.current?.abort();
    tabRequestRef.current?.abort();
    setDetailBusy(false);
    setTableSearch("");
    setInvoiceStatusFilter("ALL");
    setCommissionStatusFilter("ALL");
    setTrackingStatusFilter("ALL");
    setCustomerStats({});
    setInvoicesPage(1);
    setInvoicesTotal(0);
    setInvoicesTotalPages(1);
    setCommissionsPage(1);
    setCommissionsTotal(0);
    setCommissionsTotalPages(1);
    setTripsPage(1);
    setTripsTotal(0);
    setTripsTotalPages(1);

    const listPartner = partners.find((partner) => partner.id === selectedPartnerId);
    primePartnerDetail(listPartner);
    void loadProfile(selectedPartnerId);
    void loadSummary(selectedPartnerId);
  }, [selectedPartnerId, partners, primePartnerDetail, loadProfile, loadSummary]);

  useEffect(() => {
    if (!selectedPartnerId) return;
    if (activeTab === "customers") {
      tabRequestRef.current?.abort();
      setDetailBusy(false);
      void loadCustomerStats(selectedPartnerId);
      return;
    }
    void loadTabData(selectedPartnerId, activeTab, 1);
  }, [selectedPartnerId, activeTab, loadCustomerStats, loadTabData]);

  useEffect(() => {
    return () => {
      profileRequestRef.current?.abort();
      summaryRequestRef.current?.abort();
      customerStatsRequestRef.current?.abort();
      tabRequestRef.current?.abort();
    };
  }, []);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((partner) =>
      [
        partner.partnerUser?.name,
        partner.partnerUser?.mobileNumber,
        partner.partnerUser?.identity,
        partner.code,
        partner.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [partners, search]);

  const selectedPartner = detail?.profile;
  const partnerSummary = useMemo<ChannelPartnerSummary>(() => detail?.summary || {
    customers: 0,
    invoices: 0,
    premiumTotal: 0,
    commissionPending: 0,
    commissionPayable: 0,
    commissionPaid: 0,
    activeTrips: 0,
    pendingPayments: 0,
  }, [detail?.summary]);
  const q = tableSearch.trim().toLowerCase();

  const customerRows = useMemo(() => {
    const rows = (detail?.customers || []).map((row) => ({
      ...row,
      stats: row.stats || customerStats[row.customer.id] || EMPTY_CUSTOMER_STATS,
    }));
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.customer.name,
        row.customer.mobileNumber,
        row.customer.identity,
        row.status,
      ].some((item) => searchable(item).includes(q)),
    );
  }, [customerStats, detail?.customers, q]);

  const invoiceRows = useMemo(() => {
    let rows = detail?.invoices || [];
    if (invoiceStatusFilter !== "ALL") rows = rows.filter((row) => row.paymentStatus === invoiceStatusFilter);
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.invoiceNumber,
        row.billToName,
        row.shipToName,
        row.insuredPersonNameSnapshot,
        row.vehicleNumber,
        row.paymentStatus,
      ].some((item) => searchable(item).includes(q)),
    );
  }, [detail?.invoices, q, invoiceStatusFilter]);

  const commissionRows = useMemo(() => {
    let rows = detail?.commissions || [];
    if (commissionStatusFilter !== "ALL") rows = rows.filter((row) => row.status === commissionStatusFilter);
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.invoiceNumber,
        row.invoiceId,
        row.customer?.name,
        row.customer?.mobileNumber,
        row.status,
      ].some((item) => searchable(item).includes(q)),
    );
  }, [detail?.commissions, q, commissionStatusFilter]);

  const tripRows = useMemo(() => {
    let rows = detail?.trips || [];
    if (trackingStatusFilter !== "ALL") {
      rows = rows.filter((row) => row.status === trackingStatusFilter);
    }
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.vehicleNumber,
        row.invoice?.invoiceNumber,
        row.src,
        row.dest,
        row.status,
        row.lastLocation?.address,
      ].some((item) => searchable(item).includes(q)),
    );
  }, [detail?.trips, q, trackingStatusFilter]);

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
      toast.error(response.message || "Failed to update partner");
      return;
    }
    toast.success("Channel partner updated");
    await loadPartners();
    await Promise.all([loadProfile(selectedPartner.id), loadSummary(selectedPartner.id)]);
  };

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    const response = await adminApi.searchUsers(userSearch, 10);
    if (response.success) {
      setUserResults(response.data || []);
    } else {
      toast.error(response.message || "Failed to search users");
    }
  };

  const assignCustomer = async () => {
    if (!selectedPartner?.id || !assigningUserId) return;
    const response = await adminApi.addChannelPartnerCustomer(selectedPartner.id, assigningUserId);
    if (!response.success) {
      toast.error(response.message || "Failed to assign customer");
      return;
    }
    toast.success("Customer assigned");
    setAssigningUserId("");
    setUserSearch("");
    setUserResults([]);
    await Promise.all([loadProfile(selectedPartner.id), loadSummary(selectedPartner.id), loadCustomerStats(selectedPartner.id)]);
    await loadPartners();
  };

  const updateLink = async (linkId: string, status: "APPROVED" | "REMOVED") => {
    const response = await adminApi.updateChannelPartnerCustomerLink(linkId, status);
    if (!response.success) {
      toast.error(response.message || "Failed to update link");
      return;
    }
    toast.success(status === "APPROVED" ? "Customer link approved" : "Customer link removed");
    if (selectedPartner?.id) {
      await Promise.all([loadProfile(selectedPartner.id), loadSummary(selectedPartner.id), loadCustomerStats(selectedPartner.id)]);
      await loadPartners();
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[720px] flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Channel Partners</h1>
          <p className="text-sm text-slate-500">
            Portfolio, customer assignment, invoice health, tracking, and 15% premium commissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPartners()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3">
            <SearchBox value={search} onChange={setSearch} placeholder="Search partner" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {filteredPartners.map((partner) => (
              <Link
                key={partner.id}
                href={`/admin/channel-partners/partner/${partner.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  primePartnerDetail(partner);
                  setSelectedPartnerId(partner.id);
                }}
                className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${
                  selectedPartnerId === partner.id ? "bg-blue-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                       {partner.partnerUser?.name || "Unnamed partner"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {partner.partnerUser?.mobileNumber || "-"} · {partner.code}
                    </p>
                  </div>
                  <StatusPill status={partner.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <MiniStat label="Customers" value={partner.summary.customers} />
                  <MiniStat label="Premium" value={formatCurrency(partner.summary.premiumTotal)} />
                  <MiniStat label="Payable" value={formatCurrency(partner.summary.commissionPayable)} />
                </div>
              </Link>
            ))}
            {!filteredPartners.length ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {busy ? "Loading partners..." : "No channel partners yet."}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {!detail ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
              Select a channel partner to inspect portfolio details.
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Partner Profile
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-950">
                        {selectedPartner?.partnerUser?.name || "Partner"}
                      </h2>
                      <StatusPill status={selectedPartner?.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedPartner?.partnerUser?.mobileNumber || "-"} · Code {selectedPartner?.code} ·{" "}
                      {(Number(selectedPartner?.commissionRate || 0) * 100).toFixed(0)}% commission
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStatus("ACTIVE")}
                      disabled={selectedPartner?.status === "ACTIVE"}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatus("SUSPENDED")}
                      disabled={selectedPartner?.status === "SUSPENDED"}
                      className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  </div>
                </div>

                <div className={`mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 ${summaryBusy ? "opacity-70" : ""}`}>
                  <Metric icon={Users} label="Customers" value={String(partnerSummary.customers)} />
                  <Metric icon={FileText} label="Invoices" value={String(partnerSummary.invoices)} />
                  <Metric icon={BadgeIndianRupee} label="Premium" value={formatCurrency(partnerSummary.premiumTotal)} />
                  <Metric icon={BadgeIndianRupee} label="Pending" value={formatCurrency(partnerSummary.commissionPending)} />
                  <Metric icon={BadgeIndianRupee} label="Payable" value={formatCurrency(partnerSummary.commissionPayable)} />
                  <Metric icon={MapPin} label="Active Trips" value={String(partnerSummary.activeTrips)} />
                </div>

                <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_auto_auto]">
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchUsers();
                    }}
                    placeholder="Assign customer by name or phone"
                    className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => void searchUsers()}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => void assignCustomer()}
                    disabled={!assigningUserId}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Assign
                  </button>
                  {userResults.length ? (
                    <div className="grid gap-2 lg:col-span-3 md:grid-cols-2 xl:grid-cols-3">
                      {userResults.map((user) => (
                        <label
                          key={user.id}
                          className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                            assigningUserId === user.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="customerUserId"
                            checked={assigningUserId === user.id}
                            onChange={() => setAssigningUserId(user.id)}
                            className="mr-2"
                          />
                          <span className="font-semibold">{user.name}</span>
                          <span className="ml-2 text-slate-500">{user.mobileNumber}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.key);
                        setTableSearch("");
                      }}
                      className={`rounded px-3 py-1.5 text-sm font-semibold ${
                        activeTab === tab.key
                          ? "bg-slate-950 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-1 flex-wrap justify-end gap-2">
                  {availableStatuses.length ? (
                    <select
                      value={activeStatusFilter}
                      onChange={(event) => setActiveStatusFilter(event.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      <option value="ALL">All statuses</option>
                      {availableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="min-w-[16rem] max-w-sm flex-1">
                    <SearchBox
                      value={tableSearch}
                      onChange={setTableSearch}
                      placeholder={`Search ${activeTab}`}
                    />
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {detailBusy ? (
                  <Empty label="Loading partner detail..." />
                ) : activeTab === "customers" ? (
                  <CustomersTable rows={customerRows} onUpdateLink={updateLink} />
                ) : activeTab === "invoices" ? (
                  <>
                    <InvoicesTable rows={invoiceRows} />
                    <PaginationFooter
                      label="invoices"
                      page={invoicesPage}
                      total={invoicesTotal}
                      totalPages={invoicesTotalPages}
                      visibleCount={invoiceRows.length}
                      busy={detailBusy}
                      onPageChange={(page) => void loadTabData(selectedPartnerId, "invoices", page)}
                    />
                  </>
                ) : activeTab === "commissions" ? (
                  <>
                    <CommissionsTable rows={commissionRows} />
                    <PaginationFooter
                      label="commissions"
                      page={commissionsPage}
                      total={commissionsTotal}
                      totalPages={commissionsTotalPages}
                      visibleCount={commissionRows.length}
                      busy={detailBusy}
                      onPageChange={(page) => void loadTabData(selectedPartnerId, "commissions", page)}
                    />
                  </>
                ) : (
                  <>
                    <TrackingTable rows={tripRows} />
                    <PaginationFooter
                      label="trips"
                      page={tripsPage}
                      total={tripsTotal}
                      totalPages={tripsTotalPages}
                      visibleCount={tripRows.length}
                      busy={detailBusy}
                      onPageChange={(page) => void loadTabData(selectedPartnerId, "tracking", page)}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </section>
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
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillClass(status)}`}>
      {status || "-"}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="truncate font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function CustomersTable({
  rows,
  onUpdateLink,
}: {
  rows: NonNullable<ChannelPartnerDetailPayload["customers"]>;
  onUpdateLink: (linkId: string, status: "APPROVED" | "REMOVED") => void;
}) {
  return (
    <Table>
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
        {(rows ?? []).map((row) => (
          <tr key={row.linkId} className="hover:bg-slate-50">
            <Td>
              <p>
                <Link
                  href={`/admin/channel-partners/customer/${row.customer.id}`}
                  target="_blank"
                  className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                >
                  {row.customer.name}
                </Link>
              </p>
              <p className="text-xs text-slate-500">
                {row.customer.mobileNumber} · {row.customer.identity || "No identity"}
              </p>
            </Td>
            <Td><StatusPill status={row.status} /></Td>
            <Td>{row.stats.invoices}</Td>
            <Td>{formatCurrency(row.stats.premiumTotal)}</Td>
            <Td>{row.stats.pendingPayments}</Td>
            <Td>{formatDate(row.stats.lastInvoiceDate)}</Td>
            <Td>
              <div className="flex gap-2">
                {row.status !== "APPROVED" ? (
                  <button
                    type="button"
                    onClick={() => onUpdateLink(row.linkId, "APPROVED")}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                ) : null}
                {row.status !== "REMOVED" ? (
                  <button
                    type="button"
                    onClick={() => onUpdateLink(row.linkId, "REMOVED")}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </Td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={7} label="No customers match this view." /> : null}
      </tbody>
    </Table>
  );
}

function InvoicesTable({ rows }: { rows: ChannelPartnerInvoicePayload[] }) {
  return (
    <Table>
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <tr key={row.id} className="hover:bg-slate-50">
            <Td>
              <p className="font-semibold text-slate-950">{row.invoiceNumber}</p>
              <p className="text-xs text-slate-500">{row.productName || "-"}</p>
            </Td>
            <Td>{row.billToName || row.insuredPersonNameSnapshot || row.shipToName || "-"}</Td>
            <Td>{row.vehicleNumber || "-"}</Td>
            <Td>{formatDate(row.invoiceDate)}</Td>
            <Td><StatusPill status={row.paymentStatus} /></Td>
            <Td>{formatCurrency(row.premiumAmount)}</Td>
            <Td>
              <div className="flex gap-3 text-xs font-semibold">
                {row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Invoice</a> : null}
                {row.insuranceUrl ? <a href={row.insuranceUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Policy</a> : null}
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
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <tr key={row.id} className="hover:bg-slate-50">
            <Td>
              <p className="font-semibold text-slate-950">{row.invoiceNumber || row.invoiceId}</p>
              <p className="text-xs text-slate-500">{formatDate(row.invoiceDate)}</p>
            </Td>
            <Td>
              <p>{row.customer?.name || "-"}</p>
              <p className="text-xs text-slate-500">{row.customer?.mobileNumber || ""}</p>
            </Td>
            <Td><StatusPill status={row.status} /></Td>
            <Td>{formatCurrency(row.premiumAmount)}</Td>
            <Td>{(Number(row.commissionRate || 0) * 100).toFixed(0)}%</Td>
            <Td className="font-semibold text-slate-950">{formatCurrency(row.commissionAmount)}</Td>
            <Td>{formatDate(row.paidAt)}</Td>
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
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <Th>Vehicle</Th>
          <Th>Route</Th>
          <Th>Trip Progress</Th>
          <Th>Current Location</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => {
          const source = firstReadable(row.sourceName, row.src) || "Pickup point";
          const destination = firstReadable(row.destinationName, row.dest) || "Delivery point";
          const progress = tripProgress(row);
          const detail = tripProgressDetail(row);
          return (
            <tr key={row.id} className="hover:bg-slate-50">
              <Td>
                <p className="font-semibold text-slate-900">{row.vehicleNumber || "Vehicle pending"}</p>
                <p className="text-xs text-slate-500">{row.invoice?.invoiceNumber || "Invoice pending"}</p>
              </Td>
              <Td className="min-w-[18rem]">
                <div className="flex items-start gap-2">
                  <Route className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-800">{source}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">to {destination}</p>
                  </div>
                </div>
              </Td>
              <Td className="min-w-[14rem]">
                <div className="flex items-center justify-between gap-3">
                  <StatusPill status={row.status} />
                  <span className="text-sm font-bold text-slate-900">{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
                {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
              </Td>
              <Td className="max-w-sm">
                <p className="truncate font-medium text-slate-700">{row.lastLocation?.address || "Current location pending"}</p>
                {row.lastLocation?.timeRecorded ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(row.lastLocation.timeRecorded)}
                  </p>
                ) : null}
              </Td>
            </tr>
          );
        })}
        {!rows.length ? <EmptyRow colSpan={4} label="No trips match this view." /> : null}
      </tbody>
    </Table>
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

function Table({ children }: { children: React.ReactNode }) {
  return <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-slate-700 ${className}`}>{children}</td>;
}

function Empty({ label }: { label: string }) {
  return <div className="p-10 text-center text-sm text-slate-500">{label}</div>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}
