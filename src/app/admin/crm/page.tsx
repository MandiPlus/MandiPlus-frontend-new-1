'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneCall, MessageSquare, TrendingDown, Users, IndianRupee, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { adminApi, InsurancePaymentRow } from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { itemsData } from '@/features/insurance/productCatalog';
import {
  ALL_MANDI_FILTER_VALUES,
  formatMandiFilterLabel,
  MANDI_OPTION_GROUPS,
  UNMAPPED_MANDI_VALUE,
} from '@/features/insurance/mandiDirectory';

type CrmTab = 'daily' | 'payment';

type CrmCallLog = {
  id: string;
  insuredPersonKey: string;
  insuredPersonName: string;
  insuredPersonUserId: string | null;
  phone: string | null;
  remarks: string | null;
  calledByAdminName: string | null;
  calledAt: string;
  updatedAt: string;
};

type InsuredPersonSummary = {
  key: string;
  name: string;
  phone: string;
  invoiceCount: number;
  lastInvoiceDate: string | null;
  commodity: string;
  pendingAmount: number;
  pendingInvoices: number;
  invoiceIds: string[];
  userId: string | null;
};

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getEffectiveBalance(row: InsurancePaymentRow): number {
  const status = String(row.paymentStatus || '').toUpperCase();
  if (status === 'PAID') return 0;
  const premium = Number(row.premiumAmount || 0);
  const paid = Number(row.paymentAmount || 0);
  return Math.max(premium - paid, 0);
}

function formatDateForInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const FETCH_LIMIT = 600;

export default function AdminCrmPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();

  const [activeTab, setActiveTab] = useState<CrmTab>('daily');
  const [rows, setRows] = useState<InsurancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Persisted call logs
  const [callLogs, setCallLogs] = useState<Record<string, CrmCallLog>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Session-local remark edit state
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});
  const [remarkOpen, setRemarkOpen] = useState<Record<string, boolean>>({});

  // Filters
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    return formatDateForInput(d);
  }, []);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState('');
  const [productName, setProductName] = useState('');
  const [mandiNameFilter, setMandiNameFilter] = useState<Set<string>>(() => new Set());
  const [committedMandiKey, setCommittedMandiKey] = useState('');
  const [mandiDropdownOpen, setMandiDropdownOpen] = useState(false);
  const mandiDropdownRef = useRef<HTMLDivElement>(null);

  // Commit mandi filter only on close
  useEffect(() => {
    if (mandiDropdownOpen) return;
    const key = Array.from(mandiNameFilter).sort().join(',');
    if (key === committedMandiKey) return;
    setCommittedMandiKey(key);
  }, [mandiDropdownOpen, mandiNameFilter, committedMandiKey]);

  const mandiParam = useMemo(() => {
    if (!committedMandiKey) return undefined;
    const vals = committedMandiKey.split(',').filter(Boolean);
    if (!vals.length || vals.length === ALL_MANDI_FILTER_VALUES.length) return undefined;
    return committedMandiKey;
  }, [committedMandiKey]);

  const fetchCallLogs = useCallback(async () => {
    try {
      const res = await adminApi.getCrmCallLogs();
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, CrmCallLog> = {};
        for (const log of res.data as CrmCallLog[]) {
          map[log.insuredPersonKey] = log;
        }
        setCallLogs(map);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceRes] = await Promise.all([
        adminApi.getInsurancePayments({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          productName: productName || undefined,
          mandiName: mandiParam,
          limit: FETCH_LIMIT,
          page: 1,
        }),
        fetchCallLogs(),
      ]);
      if (!invoiceRes.success) throw new Error(invoiceRes.message || 'Failed to load data');
      setRows(Array.isArray(invoiceRes.data) ? invoiceRes.data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, productName, mandiParam, fetchCallLogs]);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/admin/login'); return; }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mandiDropdownRef.current && !mandiDropdownRef.current.contains(e.target as Node)) {
        setMandiDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Aggregate rows into per-person summaries
  const allPersons = useMemo((): InsuredPersonSummary[] => {
    const map = new Map<string, InsuredPersonSummary>();
    for (const row of rows) {
      const rawName = String(row.insuredPerson || row.buyer || 'Unknown').trim().replace(/\s+/g, ' ');
      const key = `name:${normalizeName(rawName)}`;
      const balance = getEffectiveBalance(row);
      const isPending = balance > 0;

      const existing = map.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        if (!existing.phone && row.recipientPhone) existing.phone = row.recipientPhone;
        if (!existing.lastInvoiceDate && (row.invoiceDate || row.createdAt)) {
          existing.lastInvoiceDate = row.invoiceDate || row.createdAt || null;
        }
        if (!existing.commodity && row.productName) existing.commodity = row.productName;
        if (!existing.userId && (row as any).insuredPersonUserId) existing.userId = (row as any).insuredPersonUserId;
        if (isPending) {
          existing.pendingAmount += balance;
          existing.pendingInvoices += 1;
          existing.invoiceIds.push(row.invoiceId);
        }
      } else {
        map.set(key, {
          key,
          name: rawName,
          phone: row.recipientPhone || '',
          invoiceCount: 1,
          lastInvoiceDate: row.invoiceDate || row.createdAt || null,
          commodity: row.productName || '',
          pendingAmount: isPending ? balance : 0,
          pendingInvoices: isPending ? 1 : 0,
          invoiceIds: isPending ? [row.invoiceId] : [],
          userId: (row as any).insuredPersonUserId || null,
        });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const dailyPersons = useMemo(() =>
    [...allPersons].sort((a, b) => b.invoiceCount - a.invoiceCount),
    [allPersons]
  );

  const paymentPersons = useMemo(() =>
    [...allPersons]
      .filter(p => p.pendingAmount > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount),
    [allPersons]
  );

  const totalPending = useMemo(() =>
    paymentPersons.reduce((s, p) => s + p.pendingAmount, 0),
    [paymentPersons]
  );

  const productOptions = useMemo(() => itemsData.map(i => i.name), []);

  function resetFilters() {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    setFromDate(formatDateForInput(d));
    setToDate('');
    setProductName('');
    setMandiNameFilter(new Set());
    setCommittedMandiKey('');
  }

  async function markCalled(person: InsuredPersonSummary) {
    const alreadyCalled = Boolean(callLogs[person.key]);
    setSavingKey(person.key);
    try {
      if (alreadyCalled) {
        await adminApi.deleteCrmCallLog(person.key);
        setCallLogs(prev => {
          const next = { ...prev };
          delete next[person.key];
          return next;
        });
      } else {
        const res = await adminApi.upsertCrmCallLog({
          insuredPersonKey: person.key,
          insuredPersonName: person.name,
          insuredPersonUserId: person.userId,
          phone: person.phone,
          remarks: remarkDraft[person.key] || null,
        });
        if (res.success && res.data) {
          setCallLogs(prev => ({ ...prev, [person.key]: res.data as CrmCallLog }));
        }
      }
    } catch {
      toast.error('Failed to update call status');
    } finally {
      setSavingKey(null);
    }
  }

  async function saveRemarks(person: InsuredPersonSummary) {
    const draft = remarkDraft[person.key] ?? '';
    setSavingKey(person.key);
    try {
      if (callLogs[person.key]) {
        // already called — just update remarks
        await adminApi.updateCrmCallLogRemarks(person.key, draft);
        setCallLogs(prev => ({
          ...prev,
          [person.key]: { ...prev[person.key], remarks: draft },
        }));
      } else {
        // upsert (marks as called too)
        const res = await adminApi.upsertCrmCallLog({
          insuredPersonKey: person.key,
          insuredPersonName: person.name,
          insuredPersonUserId: person.userId,
          phone: person.phone,
          remarks: draft,
        });
        if (res.success && res.data) {
          setCallLogs(prev => ({ ...prev, [person.key]: res.data as CrmCallLog }));
        }
      }
      toast.success('Note saved');
      setRemarkOpen(prev => ({ ...prev, [person.key]: false }));
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSavingKey(null);
    }
  }

  function openUserDetail(person: InsuredPersonSummary) {
    const params = new URLSearchParams();
    params.set('name', person.name);
    params.set('phone', person.phone);
    if (person.userId) params.set('userId', person.userId);
    params.set('invoiceIds', person.invoiceIds.join(','));
    params.set('totalPending', String(Math.round(person.pendingAmount)));
    window.open(`/admin/crm/user?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  const MandiDropdown = (
    <div className="relative" ref={mandiDropdownRef}>
      <button
        type="button"
        onClick={() => setMandiDropdownOpen(o => !o)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white flex items-center gap-2 min-w-[160px] max-w-[240px]"
      >
        <span className="truncate">{formatMandiFilterLabel(mandiNameFilter)}</span>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {mandiDropdownOpen && (
        <div className="absolute z-50 mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg py-1 text-gray-900">
          <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm font-medium border-b border-gray-100 sticky top-0 bg-white">
            <input type="checkbox" className="mr-2"
              checked={mandiNameFilter.size === 0 || mandiNameFilter.size === ALL_MANDI_FILTER_VALUES.length}
              onChange={() => setMandiNameFilter(new Set())} />
            All Mandis
          </label>
          {MANDI_OPTION_GROUPS.map(group => {
            const groupVals = group.options.map(o => o.value);
            const selCount = groupVals.filter(v => mandiNameFilter.has(v)).length;
            const allSel = groupVals.length > 0 && selCount === groupVals.length;
            const someSel = selCount > 0 && selCount < groupVals.length;
            return (
              <div key={group.state} className="border-b border-gray-100 last:border-b-0">
                <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm font-semibold bg-gray-50/80">
                  <input type="checkbox" className="mr-2" checked={allSel}
                    ref={el => { if (el) el.indeterminate = someSel; }}
                    onChange={() => {
                      setMandiNameFilter(prev => {
                        const next = new Set(prev);
                        if (allSel) groupVals.forEach(v => next.delete(v));
                        else groupVals.forEach(v => next.add(v));
                        if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                        return next;
                      });
                    }} />
                  <span className="flex-1">{group.state}</span>
                  <span className="text-xs font-normal text-gray-500">{selCount}/{groupVals.length}</span>
                </label>
                {group.options.map(opt => (
                  <label key={opt.value} className="flex items-center pl-7 pr-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" className="mr-2" checked={mandiNameFilter.has(opt.value)}
                      onChange={() => {
                        setMandiNameFilter(prev => {
                          const next = new Set(prev);
                          if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
                          if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                          return next;
                        });
                      }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            );
          })}
          <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm border-t border-gray-100">
            <input type="checkbox" className="mr-2" checked={mandiNameFilter.has(UNMAPPED_MANDI_VALUE)}
              onChange={() => {
                setMandiNameFilter(prev => {
                  const next = new Set(prev);
                  if (next.has(UNMAPPED_MANDI_VALUE)) next.delete(UNMAPPED_MANDI_VALUE); else next.add(UNMAPPED_MANDI_VALUE);
                  if (next.size === ALL_MANDI_FILTER_VALUES.length) return new Set();
                  return next;
                });
              }} />
            Other / Unmapped
          </label>
          <div className="sticky bottom-0 border-t border-gray-100 bg-white px-3 py-2">
            <button type="button" onClick={() => setMandiDropdownOpen(false)}
              className="w-full rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">CRM</h1>
            <p className="mt-0.5 text-sm text-gray-500">Daily followups &amp; payment collection</p>
          </div>
          <button type="button" onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          {([
            { id: 'daily' as CrmTab, label: 'Daily Followups', icon: PhoneCall },
            { id: 'payment' as CrmTab, label: 'Payment Followups', icon: IndianRupee },
          ]).map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#4309ac] text-[#4309ac]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            {activeTab === 'daily' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">From</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">To</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Commodity</label>
              <select value={productName} onChange={e => setProductName(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Commodities</option>
                {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Place / State</label>
              {MandiDropdown}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 opacity-0">Reset</label>
              <button type="button" onClick={resetFilters}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Reset
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        )}

        {/* ── Daily Followups ── */}
        {!loading && activeTab === 'daily' && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#4309ac]" />
                <span className="text-sm font-semibold text-gray-800">{dailyPersons.length} insured persons</span>
                <span className="text-xs text-gray-400">sorted by vehicles (high → low) &middot; last 10 days</span>
              </div>
              <span className="text-xs text-gray-400">
                {Object.keys(callLogs).length > 0 ? `${Object.keys(callLogs).length} called` : ''}
              </span>
            </div>
            {dailyPersons.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No data for selected filters</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Insured Person</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicles</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commodity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dailyPersons.map((person, idx) => {
                      const log = callLogs[person.key];
                      const isCalled = Boolean(log);
                      const isRemarkOpen = remarkOpen[person.key];
                      const isSaving = savingKey === person.key;
                      return (
                        <tr key={person.key} className={`transition-colors ${isCalled ? 'bg-emerald-50/30' : 'hover:bg-gray-50/60'}`}>
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm text-gray-900">{person.name}</div>
                            {isCalled && (
                              <div className="mt-0.5 flex items-center gap-1">
                                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Called
                                  {log.calledByAdminName ? ` by ${log.calledByAdminName}` : ''}
                                </span>
                                {log.remarks && (
                                  <span className="ml-2 text-xs text-gray-500 italic truncate max-w-[200px]">“{log.remarks}”</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {person.phone ? (
                              <a href={`tel:${person.phone}`} className="text-sm text-[#4309ac] hover:underline font-mono">
                                {person.phone}
                              </a>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-[#4309ac]/10 text-[#4309ac] text-sm font-bold px-3 py-0.5 min-w-[2.5rem]">
                              {person.invoiceCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{person.commodity || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(person.lastInvoiceDate)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => markCalled(person)} disabled={isSaving}
                                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                  isCalled
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                }`}>
                                <Phone className="h-3 w-3" />
                                {isSaving ? '...' : isCalled ? 'Called ✓' : 'Mark Called'}
                              </button>
                              <button type="button"
                                onClick={() => {
                                  setRemarkOpen(prev => ({ ...prev, [person.key]: !isRemarkOpen }));
                                  if (!remarkDraft[person.key] && log?.remarks) {
                                    setRemarkDraft(prev => ({ ...prev, [person.key]: log.remarks ?? '' }));
                                  }
                                }}
                                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                                <MessageSquare className="h-3 w-3" />
                                Note
                              </button>
                            </div>
                            {isRemarkOpen && (
                              <div className="mt-2 space-y-1.5">
                                <textarea rows={2} placeholder="Add a note..."
                                  value={remarkDraft[person.key] ?? log?.remarks ?? ''}
                                  onChange={e => setRemarkDraft(prev => ({ ...prev, [person.key]: e.target.value }))}
                                  className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-[#4309ac]/30 min-w-[200px]" />
                                <button type="button" onClick={() => saveRemarks(person)} disabled={isSaving}
                                  className="rounded-md bg-[#4309ac] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#4309ac]/90 disabled:opacity-50">
                                  {isSaving ? 'Saving...' : 'Save Note'}
                                </button>
                              </div>
                            )}
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

        {/* ── Payment Followups ── */}
        {!loading && activeTab === 'payment' && (
          <div className="space-y-4">
            {paymentPersons.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Total Dues</p>
                  <p className="mt-1 text-xl font-bold text-red-700">{formatCurrency(totalPending)}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Persons with Dues</p>
                  <p className="mt-1 text-xl font-bold text-amber-700">{paymentPersons.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Pending Invoices</p>
                  <p className="mt-1 text-xl font-bold text-slate-700">
                    {paymentPersons.reduce((s, p) => s + p.pendingInvoices, 0)}
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-800">{paymentPersons.length} persons with pending dues</span>
                <span className="text-xs text-gray-400">sorted by amount (high → low) &middot; tap row to collect payment</span>
              </div>
              {paymentPersons.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">No pending dues for selected filters</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Insured Person</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Dues</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoices</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commodity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paymentPersons.map((person, idx) => (
                        <tr key={person.key} className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                          onClick={() => openUserDetail(person)}>
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm text-gray-900">{person.name}</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600" onClick={e => e.stopPropagation()}>
                            {person.phone ? (
                              <a href={`tel:${person.phone}`} className="text-[#4309ac] hover:underline">{person.phone}</a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-bold text-red-700">{formatCurrency(person.pendingAmount)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-0.5">
                              {person.pendingInvoices}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{person.commodity || '—'}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => openUserDetail(person)}
                              className="flex items-center gap-1.5 rounded-md border border-[#4309ac]/20 bg-[#4309ac]/5 px-2.5 py-1.5 text-xs font-medium text-[#4309ac] hover:bg-[#4309ac]/10 transition-colors">
                              View &amp; Pay →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-600">Total</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{formatCurrency(totalPending)}</td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-gray-600">
                          {paymentPersons.reduce((s, p) => s + p.pendingInvoices, 0)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
