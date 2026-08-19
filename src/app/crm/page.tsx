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

      const records = Array.isArray(res?.records)
        ? res.records
        : Array.isArray((res as any)?.data?.records)
        ? (res as any).data.records
        : [];
      const sum = res?.summary || (res as any)?.data?.summary || null;

      setAllRecords(records);
      if (sum) {
        setSummary(sum);
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

      {/* Clean Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4309ac] flex items-center justify-center text-white font-bold text-sm">
              CRM
            </div>
            <h1 className="text-base font-bold text-gray-900">MandiPlus CRM</h1>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-4">
        {/* Tabs */}
        <div className="flex bg-gray-200/80 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all " + (
              activeTab === "daily"
                ? "bg-white text-[#4309ac] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Daily Followups
            <span
              className={"ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold " + (
                activeTab === "daily" ? "bg-purple-100 text-[#4309ac]" : "bg-gray-300/80 text-gray-700"
              )}
            >
              {summary.totalDailyPersons || allRecords.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payment")}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all " + (
              activeTab === "payment"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <IndianRupee className="h-3.5 w-3.5" />
            Payment Followups
            <span
              className={"ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold " + (
                activeTab === "payment" ? "bg-red-100 text-red-700" : "bg-gray-300/80 text-gray-700"
              )}
            >
              {summary.personsWithDuesCount ||
                allRecords.filter((r) => r.pendingAmount > 0).length}
            </span>
          </button>
        </div>

        {/* Clean Stat Cards */}
        {activeTab === "payment" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                Total Outstanding Dues
              </span>
              <p className="mt-1 text-2xl font-black text-red-700">
                {formatCurrency(summary.totalDues)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Persons with Dues
              </span>
              <p className="mt-1 text-2xl font-black text-amber-800">
                {summary.personsWithDuesCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Pending Invoices
              </span>
              <p className="mt-1 text-2xl font-black text-slate-800">
                {summary.totalPendingInvoices}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
              <span className="text-xs font-bold text-[#4309ac] uppercase tracking-wide">
                Total Insured Persons
              </span>
              <p className="mt-1 text-2xl font-black text-[#4309ac]">
                {summary.totalDailyPersons}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                Total Vehicles Loaded
              </span>
              <p className="mt-1 text-2xl font-black text-blue-800">{summary.totalVehicles}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                Followup Calls Logged
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-800">
                {summary.totalCalledCount}
              </p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search person name, mobile, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#4309ac]/30 focus:border-[#4309ac] focus:outline-none placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="min-w-[150px]">
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none"
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

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 bg-white"
                title="From Date (Optional)"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 bg-white"
                title="To Date (Optional)"
              />
            </div>

            {(searchQuery || productName || mandiNameFilter.size > 0 || fromDate || toDate) && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-between">
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

        {/* Data Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">
                {activeTab === "daily" ? "Daily Vehicle Followups" : "Pending Payment Dues"}
              </span>
              <span className="text-xs text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full font-medium">
                {processedRecords.length} records
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Page {currentPage} of {totalPages} (20 per page)
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#4309ac]" />
              <span>Loading CRM data...</span>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No matching records found for the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-3.5 py-3 w-10 text-center">#</th>
                    <th className="px-3.5 py-3">Insured Person</th>
                    <th className="px-3.5 py-3">Mobile</th>
                    {activeTab === "daily" ? (
                      <>
                        <th className="px-3.5 py-3 text-center">Vehicles</th>
                        <th className="px-3.5 py-3">Commodity</th>
                        <th className="px-3.5 py-3">Last Invoice</th>
                        <th className="px-3.5 py-3">Followup</th>
                        <th className="px-3.5 py-3">Remarks</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3.5 py-3 text-right">Total Dues</th>
                        <th className="px-3.5 py-3 text-center">Invoices</th>
                        <th className="px-3.5 py-3">Commodity</th>
                        <th className="px-3.5 py-3">Place</th>
                        <th className="px-3.5 py-3 text-right">Action</th>
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
                          <td className="px-3.5 py-3 text-center text-xs text-gray-400 font-mono">
                            {rowNumber}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-xs text-gray-900">{person.name}</div>
                          </td>
                          <td className="px-3.5 py-3 font-mono text-xs">
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
                          <td className="px-3.5 py-3 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-purple-100 text-[#4309ac] text-xs font-bold px-2 py-0.5 min-w-[1.8rem]">
                              {person.totalInvoices}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-gray-600 text-xs">
                            {person.commodity || "—"}
                          </td>
                          <td className="px-3.5 py-3 text-gray-500 text-xs">
                            {formatDate(person.latestInvoiceDate)}
                          </td>
                          <td className="px-3.5 py-3">
                            <button
                              type="button"
                              onClick={() => toggleCallStatus(person)}
                              disabled={isSaving}
                              className={"flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-50 " + (
                                person.isCalled
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              )}
                            >
                              <Phone className="w-3 h-3" />
                              {isSaving ? "..." : person.isCalled ? "Called ✓" : "Mark Called"}
                            </button>
                            {person.isCalled && person.calledByAdminName && (
                              <div className="mt-0.5 text-[10px] text-emerald-700">
                                by {person.calledByAdminName}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 min-w-[200px]">
                            {isEditingNote ? (
                              <div className="space-y-1">
                                <textarea
                                  rows={2}
                                  placeholder="Add remark..."
                                  value={noteDraft[person.key] ?? person.remarks ?? ""}
                                  onChange={(e) =>
                                    setNoteDraft((prev) => ({
                                      ...prev,
                                      [person.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-purple-300 p-1.5 text-xs text-gray-800 focus:outline-none resize-none bg-white"
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveRemarks(person)}
                                    disabled={isSaving}
                                    className="rounded bg-[#4309ac] px-2 py-0.5 text-xs font-bold text-white hover:bg-[#4309ac]/90 disabled:opacity-50"
                                  >
                                    {isSaving ? "..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteKey(null)}
                                    className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-1 group">
                                <div className="text-xs text-gray-700">
                                  {person.remarks ? (
                                    <span className="bg-amber-50 border border-amber-200 text-amber-900 rounded px-1.5 py-0.5 inline-block text-[11px]">
                                      {person.remarks}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic text-[11px]">No remark</span>
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
                                  className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                  title="Edit remark"
                                >
                                  <MessageSquare className="w-3 h-3" />
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
                        <td className="px-3.5 py-3 text-center text-xs text-gray-400 font-mono">
                          {rowNumber}
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-xs text-gray-900">{person.name}</div>
                        </td>
                        <td
                          className="px-3.5 py-3 font-mono text-xs"
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
                        <td className="px-3.5 py-3 text-right">
                          <span className="text-sm font-black text-red-600">
                            {formatCurrency(person.pendingAmount)}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5">
                            {person.pendingInvoices}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-gray-600 text-xs">
                          {person.commodity || "—"}
                        </td>
                        <td className="px-3.5 py-3 text-gray-600 text-xs">
                          {person.place || "—"}
                        </td>
                        <td className="px-3.5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openUserDetail(person)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#4309ac] hover:bg-[#4309ac]/90 text-white px-2.5 py-1 text-xs font-bold shadow-sm transition-all"
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
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-600">
                Showing <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-bold">
                  {Math.min(currentPage * PAGE_SIZE, processedRecords.length)}
                </span>{" "}
                of <span className="font-bold">{processedRecords.length}</span> records
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                <div className="flex items-center gap-1 px-2 text-xs">
                  <span className="font-bold text-gray-800">{currentPage}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-600">{totalPages}</span>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
