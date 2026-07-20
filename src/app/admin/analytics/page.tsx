'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Download,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  adminApi,
  SalesAnalyticsPayload,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

type ReportKey =
  | 'executives'
  | 'partners'
  | 'locations'
  | 'acquisition'
  | 'followups'
  | 'lapsed'
  | 'performance';

const REPORTS: Array<{ key: ReportKey; label: string; icon: typeof UserCheck }> = [
  { key: 'executives', label: 'Field Executive Sales', icon: UserCheck },
  { key: 'partners', label: 'Channel Partner Sales', icon: Building2 },
  { key: 'locations', label: 'Location Sales', icon: MapPin },
  { key: 'acquisition', label: 'New Customers', icon: UserPlus },
  { key: 'followups', label: 'Customer Follow-ups', icon: CalendarDays },
  { key: 'lapsed', label: 'Stopped Vehicles', icon: Truck },
  { key: 'performance', label: 'Daily & Weekly', icon: CalendarDays },
];

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusClasses(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (
    normalized.includes('pass') ||
    normalized.includes('active') ||
    normalized.includes('planned')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (
    normalized.includes('risk') ||
    normalized.includes('critical') ||
    normalized.includes('overdue')
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (
    normalized.includes('review') ||
    normalized.includes('high') ||
    normalized.includes('missing')
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function Badge({ children, status = '' }: { children: React.ReactNode; status?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses(status)}`}>
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: 'slate' | 'cyan' | 'emerald' | 'violet' | 'amber' | 'indigo';
}) {
  const styles = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${styles}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail ? <p className="mt-1 text-xs opacity-70">{detail}</p> : null}
    </div>
  );
}

function TableContainer({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">{children}</div>;
}

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right = false, strong = false }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td className={`whitespace-nowrap border-b border-gray-100 px-4 py-3 text-sm ${right ? 'text-right' : 'text-left'} ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      {children}
    </td>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
      <p className="text-sm font-medium text-gray-700">No results for the selected filters.</p>
      <p className="mt-1 text-xs text-gray-500">Try a longer date range or clear the search.</p>
    </div>
  );
}

function includesSearch(row: unknown, search: string) {
  if (!search.trim()) return true;
  return JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase());
}

function ReportTable({
  report,
  data,
  search,
}: {
  report: ReportKey;
  data: SalesAnalyticsPayload;
  search: string;
}) {
  if (report === 'executives') {
    const rows = data.executives.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Field Executive</Th><Th>Attribution</Th><Th right>Verified Sales</Th><Th right>GMV</Th><Th right>Vehicles</Th><Th right>Customers</Th><Th right>Leads</Th><Th right>Meetings</Th><Th right>Open Follow-ups</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <Td strong><div>{row.name}</div><div className="mt-0.5 text-xs font-normal text-gray-500">{row.role.replaceAll('_', ' ')}</div></Td>
              <Td><Badge status={row.id === 'unattributed' ? 'Risk' : 'Pass'}>{row.attributionSource}</Badge></Td>
              <Td right strong>{formatCurrency(row.premium)}</Td>
              <Td right>{formatCurrency(row.gmv)}</Td>
              <Td right>{formatCount(row.loads)}</Td>
              <Td right>{formatCount(row.customers)}</Td>
              <Td right>{formatCount(row.leads)}</Td>
              <Td right>{formatCount(row.meetings)}</Td>
              <Td right>{formatCount(row.openFollowUps)}</Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  if (report === 'partners') {
    const rows = data.channelPartners.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Channel Partner</Th><Th>Status</Th><Th right>Linked Customers</Th><Th right>Active Customers</Th><Th right>Vehicles</Th><Th right>GMV</Th><Th right>Premium</Th><Th right>Commission</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <Td strong><div>{row.name}</div><div className="mt-0.5 text-xs font-normal text-gray-500">{row.code}</div></Td>
              <Td><Badge status={row.status}>{row.status}</Badge></Td>
              <Td right>{formatCount(row.linkedCustomers)}</Td>
              <Td right>{formatCount(row.customers)}</Td>
              <Td right>{formatCount(row.loads)}</Td>
              <Td right>{formatCurrency(row.gmv)}</Td>
              <Td right strong>{formatCurrency(row.premium)}</Td>
              <Td right>{formatCurrency(row.commission)}</Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  if (report === 'locations') {
    const rows = data.locations.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Location</Th><Th right>Share</Th><Th right>Vehicles</Th><Th right>Unique Vehicles</Th><Th right>Customers</Th><Th right>GMV</Th><Th right>Premium</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.location} className="hover:bg-gray-50">
              <Td strong>{row.location}</Td>
              <Td right>{row.share}%</Td>
              <Td right>{formatCount(row.loads)}</Td>
              <Td right>{formatCount(row.vehicles)}</Td>
              <Td right>{formatCount(row.customers)}</Td>
              <Td right>{formatCurrency(row.gmv)}</Td>
              <Td right strong>{formatCurrency(row.premium)}</Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  if (report === 'acquisition') {
    const rows = data.newCustomers.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Customer</Th><Th>Location</Th><Th>First Sale</Th><Th>Source</Th><Th right>Vehicles</Th><Th right>Unique Vehicles</Th><Th right>GMV</Th><Th right>Premium</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <Td strong>{row.name}</Td>
              <Td>{row.state || '-'}</Td>
              <Td>{formatDate(row.firstSaleDate)}</Td>
              <Td><Badge>{row.source}</Badge></Td>
              <Td right>{formatCount(row.loads)}</Td>
              <Td right>{formatCount(row.vehicles)}</Td>
              <Td right>{formatCurrency(row.gmv)}</Td>
              <Td right strong>{formatCurrency(row.premium)}</Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  if (report === 'followups') {
    const rows = data.followUps.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Customer</Th><Th>Business</Th><Th>Location</Th><Th>Status</Th><Th>Next Action</Th><Th>Due Date</Th><Th>Owner</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <Td strong>{row.customer}</Td>
              <Td>{row.business}</Td>
              <Td><div className="max-w-64 truncate" title={row.location}>{row.location}</div></Td>
              <Td><Badge>{row.status.replaceAll('_', ' ')}</Badge></Td>
              <Td><div className="max-w-72 whitespace-normal">{row.nextAction}</div></Td>
              <Td><div>{formatDate(row.dueDate)}</div><div className="mt-1"><Badge status={row.urgency}>{row.urgency}</Badge></div></Td>
              <Td>{row.owner}</Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  if (report === 'lapsed') {
    const rows = data.lapsedCustomers.filter((row) => includesSearch(row, search));
    if (!rows.length) return <EmptyState />;
    return (
      <TableContainer>
        <table className="min-w-full">
          <thead><tr><Th>Customer</Th><Th>Location</Th><Th>Last Vehicle</Th><Th>Last Sale</Th><Th right>Inactive Days</Th><Th right>Usual Frequency</Th><Th right>Lifetime Vehicles</Th><Th right>Premium at Risk / Month</Th><Th>Risk</Th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <Td strong>{row.name}</Td>
              <Td>{row.state || '-'}</Td>
              <Td><span className="font-mono text-xs font-semibold text-gray-800">{row.lastVehicle || '-'}</span></Td>
              <Td>{formatDate(row.lastSaleDate)}</Td>
              <Td right strong>{formatCount(row.daysInactive)}</Td>
              <Td right>{row.usualCadenceDays} days</Td>
              <Td right>{formatCount(row.lifetimeLoads)}</Td>
              <Td right strong>{formatCurrency(row.monthlyPremiumAtRisk)}</Td>
              <Td><Badge status={row.risk}>{row.risk}</Badge></Td>
            </tr>
          ))}</tbody>
        </table>
      </TableContainer>
    );
  }

  const daily = data.daily.filter((row) => includesSearch(row, search)).slice().reverse();
  const weekly = data.weekly.filter((row) => includesSearch(row, search)).slice().reverse();
  if (!daily.length && !weekly.length) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Daily Performance</h3>
        <TableContainer>
          <table className="min-w-full">
            <thead><tr><Th>Date</Th><Th right>Vehicles</Th><Th right>Customers</Th><Th right>GMV</Th><Th right>Premium</Th></tr></thead>
            <tbody>{daily.map((row) => <tr key={row.date} className="hover:bg-gray-50"><Td strong>{formatDate(row.date)}</Td><Td right>{formatCount(row.loads)}</Td><Td right>{formatCount(row.customers)}</Td><Td right>{formatCurrency(row.gmv)}</Td><Td right strong>{formatCurrency(row.premium)}</Td></tr>)}</tbody>
          </table>
        </TableContainer>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Weekly Performance</h3>
        <TableContainer>
          <table className="min-w-full">
            <thead><tr><Th>Week Starting</Th><Th right>Vehicles</Th><Th right>Customers</Th><Th right>GMV</Th><Th right>Premium</Th></tr></thead>
            <tbody>{weekly.map((row) => <tr key={row.weekStart} className="hover:bg-gray-50"><Td strong>{formatDate(row.weekStart)}</Td><Td right>{formatCount(row.loads)}</Td><Td right>{formatCount(row.customers)}</Td><Td right>{formatCurrency(row.gmv)}</Td><Td right strong>{formatCurrency(row.premium)}</Td></tr>)}</tbody>
          </table>
        </TableContainer>
      </div>
    </div>
  );
}

function reportRowCount(report: ReportKey, data: SalesAnalyticsPayload) {
  if (report === 'executives') return data.executives.length;
  if (report === 'partners') return data.channelPartners.length;
  if (report === 'locations') return data.locations.length;
  if (report === 'acquisition') return data.newCustomers.length;
  if (report === 'followups') return data.followUps.length;
  if (report === 'lapsed') return data.lapsedCustomers.length;
  return data.daily.length;
}

export default function SalesAnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const today = useMemo(() => dateKey(new Date()), []);
  const [fromDate, setFromDate] = useState(() => addDays(today, -29));
  const [toDate, setToDate] = useState(today);
  const [report, setReport] = useState<ReportKey>('executives');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<SalesAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.getSalesAnalytics(fromDate, toDate));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canAccessSection('reports'))) {
      router.replace('/admin/dashboard');
      return;
    }
    if (!authLoading && isAuthenticated) void fetchData();
  }, [authLoading, isAuthenticated, canAccessSection, fetchData, router]);

  const resetFilters = () => {
    setFromDate(addDays(today, -29));
    setToDate(today);
    setSearch('');
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportSalesAnalytics(fromDate, toDate);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sales-performance-${fromDate}-to-${toDate}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || (loading && !data)) {
    return <div className="flex min-h-[500px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#4309ac]" /><p className="mt-3 text-sm text-gray-600">Loading sales analytics...</p></div></div>;
  }

  if (error || !data) {
    return (
      <div className="py-6">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-red-600" />
          <p className="mt-3 text-sm font-semibold text-red-800">Failed to load sales analytics</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button onClick={() => void fetchData()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" />Retry</button>
        </div>
      </div>
    );
  }

  const activeReport = REPORTS.find((item) => item.key === report) || REPORTS[0];

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">Verified sales reports by executive, partner, location and customer.</p>
          </div>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">From date</span>
              <input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} className="w-[155px] rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">To date</span>
              <input type="date" value={toDate} min={fromDate} max={today} onChange={(event) => setToDate(event.target.value)} className="w-[155px] rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Report</span>
              <select value={report} onChange={(event) => { setReport(event.target.value as ReportKey); setSearch(''); }} className="min-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-sm">
                {REPORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void fetchData()} disabled={loading} className="inline-flex h-[38px] items-center gap-2 rounded-md bg-[#4309ac] px-4 text-sm font-medium text-white hover:bg-[#360789] disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply Filters
            </button>
            <button type="button" onClick={resetFilters} className="h-[38px] rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Reset</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="Verified Vehicles" value={formatCount(data.summary.loads)} detail={`${formatCount(data.summary.vehicles)} unique vehicles`} tone="slate" />
          <SummaryCard label="Premium Amount" value={formatCurrency(data.summary.premium)} tone="cyan" />
          <SummaryCard label="Verified GMV" value={formatCurrency(data.summary.gmv)} tone="violet" />
          <SummaryCard label="Active Customers" value={formatCount(data.summary.activeCustomers)} tone="emerald" />
          <SummaryCard label="New Customers" value={formatCount(data.summary.newCustomers)} tone="amber" />
          <SummaryCard label="Repeat Customers" value={formatCount(data.summary.repeatCustomers)} detail={`${data.summary.repeatRate.toFixed(1)}% repeat rate`} tone="indigo" />
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{activeReport.label}</h2>
                <p className="mt-0.5 text-xs text-gray-500">{reportRowCount(report, data)} rows · {formatDate(data.range.from)} to {formatDate(data.range.to)}</p>
              </div>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search results" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-[240px]" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {REPORTS.map((item) => {
                const Icon = item.icon;
                const active = item.key === report;
                return (
                  <button key={item.key} onClick={() => { setReport(item.key); setSearch(''); }} className={`inline-flex min-w-fit items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium ${active ? 'border-[#4309ac] text-[#4309ac]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    <Icon className="h-4 w-4" />{item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <ReportTable report={report} data={data} search={search} />
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700" />Data checks</span>
            <span className="text-xs font-normal text-gray-500">View coverage</span>
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-gray-200 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.quality.map((check) => (
              <div key={check.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">{check.label}</p>
                  <Badge status={check.status}>{check.status}</Badge>
                </div>
                <p className="mt-2 text-xl font-bold text-gray-900">{Number(check.coverage || 0).toFixed(1)}%</p>
                <p className="mt-1 text-xs text-gray-500">{check.explanation}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
