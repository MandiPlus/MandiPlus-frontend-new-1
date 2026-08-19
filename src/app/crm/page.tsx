"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneCall,
  MessageSquare,
  TrendingDown,
  Users,
  IndianRupee,
  RefreshCw,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  ExternalLink,
  Truck,
  ArrowRight,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { adminApi } from "@/features/admin/api/admin.api";
import { useAdmin } from "@/features/admin/context/AdminContext";
import { itemsData } from "@/features/insurance/productCatalog";
import {
  ALL_MANDI_FILTER_VALUES,
  formatMandiFilterLabel,
  MANDI_OPTION_GROUPS,
  UNMAPPED_MANDI_VALUE,
} from "@/features/insurance/mandiDirectory";

type CrmTab = "daily" | "payment";

type CrmPersonRecord = {
  key: string;
  name: string;
  phone: string;
  userId: string | null;
  totalInvoices: number;
  pendingInvoices: number;
  pendingAmount: number;
  totalPremium: number;
  totalPaid: number;
  latestInvoiceDate: string | null;
  commodity: string;
  place: string;
  isCalled: boolean;
  calledAt: string | null;
  calledByAdminName: string | null;
  remarks: string | null;
  pendingInvoiceIds: string[];
};

function formatCurrency(value: number) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_SIZE = 20;

export default function StandaloneCrmPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAdmin();

  const [activeTab, setActiveTab] = useState<CrmTab>("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [allRecords, setAllRecords] = useState<CrmPersonRecord[]>([]);
  const [summary, setSummary] = useState({
    totalDues: 0,
    personsWithDuesCount: 0,
    totalPendingInvoices: 0,
    totalDailyPersons: 0,
    totalVehicles: 0,
    totalCalledCount: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [productName, setProductName] = useState("");
  const [mandiNameFilter, setMandiNameFilter] = useState<Set<string>>(() => new Set());
  const [committedMandiKey, setCommittedMandiKey] = useState("");
  const [mandiDropdownOpen, setMandiDropdownOpen] = useState(false);
  const mandiDropdownRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingActionKey, setSavingActionKey] = useState<string | null>(null);

  useEffect(() => {
    if (mandiDropdownOpen) return;
    const key = Array.from(mandiNameFilter).sort().join(",");
    if (key === committedMandiKey) return;
    setCommittedMandiKey(key);
  }, [mandiDropdownOpen, mandiNameFilter, committedMandiKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mandiDropdownRef.current && !mandiDropdownRef.current.contains(e.target as Node)) {
        setMandiDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const mandiParam = useMemo(() => {
    if (!committedMandiKey) return undefined;
    const vals = committedMandiKey.split(",").filter(Boolean);
    if (!vals.length || vals.length === ALL_MANDI_FILTER_VALUES.length) return undefined;
    return committedMandiKey;
  }, [committedMandiKey]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getCrmData({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        productName: productName || undefined,
        mandiName: mandiParam,
        limit: 10000,
      });

      if (res && Array.isArray(res.records)) {
        setAllRecords(res.records);
        if (res.summary) {
          setSummary(res.summary);
        }
      } else {
        setAllRecords([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load CRM data");
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, productName, mandiParam]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
      if (!token) {
        router.push("/admin/login");
        return;
      }
    }
    fetchData();
  }, [authLoading, isAuthenticated, router, fetchData]);

  const processedRecords = useMemo(() => {
    let list = [...allRecords];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          (r.remarks && r.remarks.toLowerCase().includes(q)) ||
          (r.commodity && r.commodity.toLowerCase().includes(q)) ||
          (r.place && r.place.toLowerCase().includes(q)),
      );
    }

    if (activeTab === "payment") {
      list = list.filter((r) => r.pendingAmount > 0);
      list.sort((a, b) => b.pendingAmount - a.pendingAmount);
    } else {
      list.sort((a, b) => b.totalInvoices - a.totalInvoices);
    }

    return list;
  }, [allRecords, activeTab, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, productName, mandiParam, fromDate, toDate]);

  const totalPages = Math.ceil(processedRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedRecords.slice(start, start + PAGE_SIZE);
  }, [processedRecords, currentPage]);

  const productOptions = useMemo(() => itemsData.map((i) => i.name), []);

  function resetFilters() {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setProductName("");
    setMandiNameFilter(new Set());
    setCommittedMandiKey("");
    setCurrentPage(1);
  }

  async function toggleCallStatus(person: CrmPersonRecord) {
    const nextStatus = !person.isCalled;
    setSavingActionKey(person.key);
    try {
      const res = await adminApi.setCrmCallStatus({
        insuredPersonKey: person.key,
        insuredPersonName: person.name,
        insuredPersonUserId: person.userId,
        phone: person.phone,
        isCalled: nextStatus,
      });

      if (res.success && res.data) {
        setAllRecords((prev) =>
          prev.map((r) =>
            r.key === person.key
              ? {
                  ...r,
                  isCalled: res.data.isCalled,
                  calledAt: res.data.calledAt,
                  calledByAdminName: res.data.calledByAdminName,
                }
              : r,
          ),
        );
        toast.success(nextStatus ? ("Marked " + person.name + " as Called") : "Unmarked call status");
      }
    } catch {
      toast.error("Failed to update call status");
    } finally {
      setSavingActionKey(null);
    }
  }

  async function saveRemarks(person: CrmPersonRecord) {
    const text = (noteDraft[person.key] ?? person.remarks ?? "").trim();
    setSavingActionKey(person.key);
    try {
      const res = await adminApi.updateCrmRemarks({
        insuredPersonKey: person.key,
        insuredPersonName: person.name,
        insuredPersonUserId: person.userId,
        phone: person.phone,
        remarks: text,
      });

      if (res.success) {
        setAllRecords((prev) =>
          prev.map((r) => (r.key === person.key ? { ...r, remarks: text } : r)),
        );
        setEditingNoteKey(null);
        toast.success("Remark saved");
      }
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingActionKey(null);
    }
  }

  function openUserDetail(person: CrmPersonRecord) {
    const params = new URLSearchParams();
    params.set("name", person.name);
    params.set("phone", person.phone);
    if (person.userId) params.set("userId", person.userId);
    if (person.pendingInvoiceIds?.length) {
      params.set("invoiceIds", person.pendingInvoiceIds.join(","));
    }
    params.set("totalPending", String(Math.round(person.pendingAmount)));
    window.open("/crm/user?" + params.toString(), "_blank", "noopener,noreferrer");
  }

  const MandiDropdown = (
    <div className="relative" ref={mandiDropdownRef}>
      <button
        type="button"
        onClick={() => setMandiDropdownOpen((o) => !o)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white flex items-center justify-between gap-2 min-w-[170px] max-w-[240px] text-gray-700 hover:border-gray-400 focus:outline-none"
      >
        <span className="truncate">{formatMandiFilterLabel(mandiNameFilter)}</span>
        <Filter className="w-3.5 h-3.5 shrink-0 text-gray-400" />
      </button>
      {mandiDropdownOpen && (
        <div className="absolute z-50 mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl py-1 text-gray-900">
          <label className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm font-medium border-b border-gray-100 sticky top-0 bg-white">
            <input
              type="checkbox"
              className="mr-2 rounded text-[#4309ac] focus:ring-[#4309ac]"
              checked={
                mandiNameFilter.size === 0 ||
                mandiNameFilter.size === ALL_MANDI_FILTER_VALUES.length
              }
              onChange={() => setMandiNameFilter(new Set())}
            />
            All Mandis / States
          </label>
          {MANDI_OPTION_GROUPS.map((group) => {
            const groupVals = group.options.map((o) => o.value);
            const selCount = groupVals.filter((v) => mandiNameFilter.has(v)).length;
            const allSel = groupVals.length > 0 && selCount === groupVals.length;
            const someSel = selCount > 0 && selCount < groupVals.length;
            return (
              <div key={group.state} className="border-b border-gray-100 last:border-b-0">
                <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm font-semibold bg-gray-50/80">
                  <input
                    type="checkbox"
                    className="mr-2 rounded text-[#4309ac]"
                    checked={allSel}
                    ref={(el) => {
                      if (el) el.indeterminate = someSel;
                    }}
                    onChange={() => {
                      setMandiNameFilter((prev) => {
                        const next = new Set(prev);
                        if (allSel) groupVals.forEach((v) => next.delete(v));
                        else groupVals.forEach((v) => next.add(v));
                        if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                        return next;
                      });
                    }}
                  />
                  <span className="flex-1">{group.state}</span>
                  <span className="text-xs font-normal text-gray-500">
                    {selCount}/{groupVals.length}
                  </span>
                </label>
                {group.options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center pl-7 pr-3 py-1 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mr-2 rounded text-[#4309ac]"
                      checked={mandiNameFilter.has(opt.value)}
                      onChange={() => {
                        setMandiNameFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.value)) next.delete(opt.value);
                          else next.add(opt.value);
                          if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                          return next;
                        });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            );
          })}
          <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm border-t border-gray-100">
            <input
              type="checkbox"
              className="mr-2 rounded text-[#4309ac]"
              checked={mandiNameFilter.has(UNMAPPED_MANDI_VALUE)}
              onChange={() => {
                setMandiNameFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(UNMAPPED_MANDI_VALUE)) next.delete(UNMAPPED_MANDI_VALUE);
                  else next.add(UNMAPPED_MANDI_VALUE);
                  if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                  return next;
                });
              }}
            />
            Other / Unmapped
          </label>
          <div className="sticky bottom-0 border-t border-gray-100 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setMandiDropdownOpen(false)}
              className="w-full rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-16">
      <ToastContainer position="top-right" autoClose={3000} />

      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4309ac] to-[#6d28d9] flex items-center justify-center text-white font-bold shadow-md shadow-purple-200">
              M+
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">MandiPlus CRM</h1>
                <span className="bg-purple-100 text-[#4309ac] text-xs font-semibold px-2 py-0.5 rounded-full">
                  All Time Data
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Daily vehicle followup calls &amp; payment collection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50 transition-all"
            >
              <RefreshCw className={"h-4 w-4 text-gray-500 " + (loading ? "animate-spin" : "")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/dashboard")}
              className="flex items-center gap-1 rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors"
            >
              Admin Dashboard <ExternalLink className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        <div className="flex bg-gray-200/80 p-1 rounded-xl w-fit shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={"flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all " + (
              activeTab === "daily"
                ? "bg-white text-[#4309ac] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <PhoneCall className="h-4 w-4" />
            Daily Followups
            <span
              className={"ml-1 text-xs px-2 py-0.5 rounded-full font-bold " + (
                activeTab === "daily" ? "bg-purple-100 text-[#4309ac]" : "bg-gray-300/80 text-gray-700"
              )}
            >
              {summary.totalDailyPersons || allRecords.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payment")}
            className={"flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all " + (
              activeTab === "payment"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <IndianRupee className="h-4 w-4" />
            Payment Followups
            <span
              className={"ml-1 text-xs px-2 py-0.5 rounded-full font-bold " + (
                activeTab === "payment" ? "bg-red-100 text-red-700" : "bg-gray-300/80 text-gray-700"
              )}
            >
              {summary.personsWithDuesCount ||
                allRecords.filter((r) => r.pendingAmount > 0).length}
            </span>
          </button>
        </div>

        {activeTab === "payment" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  Total Outstanding Dues (All Time)
                </span>
                <IndianRupee className="w-5 h-5 text-red-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-red-700 tracking-tight">
                {formatCurrency(summary.totalDues)}
              </p>
              <p className="mt-1 text-xs text-red-600/80">Complete aggregate across all invoices</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Persons with Pending Dues
                </span>
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-800">
                {summary.personsWithDuesCount}
              </p>
              <p className="mt-1 text-xs text-amber-700/80">Insured persons with unpaid balance</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Total Pending Invoices
                </span>
                <TrendingDown className="w-5 h-5 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-800">
                {summary.totalPendingInvoices}
              </p>
              <p className="mt-1 text-xs text-slate-500">Unpaid / partially paid bills</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4309ac] uppercase tracking-wider">
                  Total Insured Persons
                </span>
                <Users className="w-5 h-5 text-[#4309ac]" />
              </div>
              <p className="mt-2 text-2xl font-black text-[#4309ac] tracking-tight">
                {summary.totalDailyPersons}
              </p>
              <p className="mt-1 text-xs text-purple-700/80">All time insured party database</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                  Total Vehicles Loaded
                </span>
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-blue-800">{summary.totalVehicles}</p>
              <p className="mt-1 text-xs text-blue-600/80">Total insured trips &amp; invoices</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Followup Calls Logged
                </span>
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-800">
                {summary.totalCalledCount}
              </p>
              <p className="mt-1 text-xs text-emerald-600/80">Marked as called by team</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search person name, mobile number, notes, place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4309ac]/30 focus:border-[#4309ac] focus:outline-none transition-all placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="min-w-[160px]">
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:border-gray-400 focus:outline-none"
              >
                <option value="">All Commodities</option>
                {productOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {MandiDropdown}

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-700 bg-white"
                title="From Date (Leave empty for All Time)"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-700 bg-white"
                title="To Date"
              />
            </div>

            {(searchQuery || productName || mandiNameFilter.size > 0 || fromDate || toDate) && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchData}
              className="text-xs underline font-bold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">
                {activeTab === "daily" ? "Daily Vehicle Followups" : "Pending Payment Dues"}
              </span>
              <span className="text-xs text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full font-medium">
                {processedRecords.length} records matched
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Showing page {currentPage} of {totalPages} (20 per page)
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#4309ac]" />
              <span>Loading CRM data...</span>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No matching records found for the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50/80 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-4 py-3.5">Insured Person</th>
                    <th className="px-4 py-3.5">Mobile Number</th>
                    {activeTab === "daily" ? (
                      <>
                        <th className="px-4 py-3.5 text-center">Vehicles</th>
                        <th className="px-4 py-3.5">Commodity</th>
                        <th className="px-4 py-3.5">Last Invoice</th>
                        <th className="px-4 py-3.5">Call Followup</th>
                        <th className="px-4 py-3.5">Remarks / Notes</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3.5 text-right">Total Dues</th>
                        <th className="px-4 py-3.5 text-center">Pending Bills</th>
                        <th className="px-4 py-3.5">Commodity</th>
                        <th className="px-4 py-3.5">Place / State</th>
                        <th className="px-4 py-3.5 text-right">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {paginatedRecords.map((person, index) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                    const isSaving = savingActionKey === person.key;
                    const isEditingNote = editingNoteKey === person.key;

                    if (activeTab === "daily") {
                      return (
                        <tr
                          key={person.key}
                          className={"transition-colors " + (
                            person.isCalled ? "bg-emerald-50/25" : "hover:bg-slate-50/70"
                          )}
                        >
                          <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-gray-900">{person.name}</div>
                            {person.userId && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                App User
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            {person.phone ? (
                              <a
                                href={"tel:" + person.phone}
                                className="text-[#4309ac] hover:underline font-semibold flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                {person.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-purple-100 text-[#4309ac] text-xs font-bold px-2.5 py-0.5 min-w-[2rem]">
                              {person.totalInvoices}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 text-xs">
                            {person.commodity || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 text-xs">
                            {formatDate(person.latestInvoiceDate)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleCallStatus(person)}
                                disabled={isSaving}
                                className={"flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 " + (
                                  person.isCalled
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                                )}
                              >
                                <Phone className="w-3 h-3" />
                                {isSaving ? "..." : person.isCalled ? "Called ✓" : "Mark Called"}
                              </button>
                            </div>
                            {person.isCalled && (
                              <div className="mt-1 text-[11px] text-emerald-700">
                                {person.calledByAdminName && ("by " + person.calledByAdminName)}
                                {person.calledAt && (" • " + formatDate(person.calledAt))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 min-w-[220px]">
                            {isEditingNote ? (
                              <div className="space-y-1.5">
                                <textarea
                                  rows={2}
                                  placeholder="Add followup remark..."
                                  value={noteDraft[person.key] ?? person.remarks ?? ""}
                                  onChange={(e) =>
                                    setNoteDraft((prev) => ({
                                      ...prev,
                                      [person.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-lg border border-purple-300 p-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30 resize-none bg-white"
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => saveRemarks(person)}
                                    disabled={isSaving}
                                    className="rounded-md bg-[#4309ac] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#4309ac]/90 disabled:opacity-50"
                                  >
                                    {isSaving ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteKey(null)}
                                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2 group">
                                <div className="text-xs text-gray-700">
                                  {person.remarks ? (
                                    <span className="font-medium bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-2 py-1 inline-block">
                                      {person.remarks}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic">No remark</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteKey(person.key);
                                    if (!noteDraft[person.key]) {
                                      setNoteDraft((prev) => ({
                                        ...prev,
                                        [person.key]: person.remarks ?? "",
                                      }));
                                    }
                                  }}
                                  className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                  title="Edit remark"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={person.key}
                        className="hover:bg-red-50/30 transition-colors cursor-pointer"
                        onClick={() => openUserDetail(person)}
                      >
                        <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-gray-900">{person.name}</div>
                          {person.userId && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                              App User
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3.5 font-mono text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {person.phone ? (
                            <a
                              href={"tel:" + person.phone}
                              className="text-[#4309ac] hover:underline font-semibold flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              {person.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-base font-black text-red-600">
                            {formatCurrency(person.pendingAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5">
                            {person.pendingInvoices}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {person.commodity || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {person.place || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openUserDetail(person)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#4309ac] hover:bg-[#4309ac]/90 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition-all"
                          >
                            Collect <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && processedRecords.length > 0 && (
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/80 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                Showing{" "}
                <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-bold">
                  {Math.min(currentPage * PAGE_SIZE, processedRecords.length)}
                </span>{" "}
                of <span className="font-bold">{processedRecords.length}</span> records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-1 px-2">
                  <span className="text-xs font-bold text-gray-800">{currentPage}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-xs text-gray-600">{totalPages}</span>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
