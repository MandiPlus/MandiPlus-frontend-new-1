'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  ClipboardList,
  Download,
  type LucideIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Table2,
} from 'lucide-react';
import {
  adminApi,
  InsuranceLearningSummary,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];

function formatNumber(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString('en-IN') : '0';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function confidenceClass(confidence: string) {
  if (confidence === 'strong') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className="rounded-md bg-slate-100 p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
  empty,
}: {
  title: string;
  columns: Array<{ key: string; label: string; render?: (row: any) => string }>;
  rows: any[];
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {column.render ? column.render(row) : String(row[column.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function InsuranceLearningPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<InsuranceLearningSummary | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [summaryResponse, markdownResponse] = await Promise.all([
      adminApi.getInsuranceLearningSummary(days),
      adminApi.getInsuranceLearningRulesMarkdown(days),
    ]);
    if (!summaryResponse.success || !summaryResponse.data) {
      setError(summaryResponse.message || 'Failed to load learning analytics.');
      setSummary(null);
    } else {
      setSummary(summaryResponse.data);
    }
    if (markdownResponse.success && markdownResponse.data?.markdown) {
      setMarkdown(markdownResponse.data.markdown);
    } else {
      setMarkdown('');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canAccessSection('insurance-learning'))) {
      router.replace('/admin/dashboard');
      return;
    }
    if (!authLoading && isAuthenticated) {
      void load();
    }
  }, [authLoading, isAuthenticated, days]);

  const suggestionCount = useMemo(() => {
    const row = summary?.sourceBreakdown?.find((item) => item.usedSuggestion === 'true');
    return Number(row?.count || 0);
  }, [summary]);

  const typedCount = useMemo(() => {
    const total = Number(summary?.totals.totalEvents || 0);
    return Math.max(total - suggestionCount, 0);
  }, [summary, suggestionCount]);

  const downloadMarkdown = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `insurance-learning-rules-${days}d.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading insurance learning...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4309ac]">
              <Sparkles className="h-4 w-4" />
              /insurance observation
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Insurance Learning</h1>
            <p className="mt-1 text-sm text-slate-600">
              Silent pattern capture from the production insurance creation flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              disabled={!markdown}
              className="inline-flex items-center rounded-md bg-[#4309ac] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#35107c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Rules MD
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Invoices Observed"
            value={formatNumber(summary?.totals.totalInvoicesObserved)}
            icon={Activity}
          />
          <StatCard label="Suggestion Uses" value={formatNumber(suggestionCount)} icon={Bot} />
          <StatCard label="Typed Creates" value={formatNumber(typedCount)} icon={Table2} />
          <StatCard
            label="Rule Candidates"
            value={formatNumber(summary?.ruleCandidates.length)}
            icon={ClipboardList}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <DataTable
            title="Supplier-Buyer Pair Patterns"
            rows={summary?.topPairs || []}
            empty="No pair patterns captured yet."
            columns={[
              { key: 'supplierName', label: 'Supplier' },
              { key: 'buyerName', label: 'Buyer' },
              { key: 'topProductName', label: 'Common Item' },
              { key: 'topHsnCode', label: 'HSN' },
              { key: 'count', label: 'Support', render: (row) => formatNumber(row.count) },
            ]}
          />

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">Rule Candidates</h2>
            </div>
            <div className="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">
              {(summary?.ruleCandidates || []).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No candidates yet. More `/insurance` events are needed.
                </div>
              ) : (
                summary?.ruleCandidates.map((rule, index) => (
                  <div key={`${rule.type}-${rule.label}-${index}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{rule.label}</p>
                        <p className="mt-1 text-sm text-slate-600">{rule.finding}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceClass(rule.confidence)}`}>
                        {rule.confidence}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                      {rule.type.replace(/_/g, ' ')} / support {rule.support}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <DataTable
            title="Product / HSN Patterns"
            rows={summary?.productPatterns || []}
            empty="No product patterns captured yet."
            columns={[
              { key: 'productName', label: 'Product' },
              { key: 'hsnCode', label: 'HSN' },
              { key: 'avgRate', label: 'Avg Rate', render: (row) => formatNumber(row.avgRate) },
              { key: 'avgQuantity', label: 'Avg Qty', render: (row) => formatNumber(row.avgQuantity) },
              { key: 'count', label: 'Support', render: (row) => formatNumber(row.count) },
            ]}
          />
          <DataTable
            title="Vehicle / Owner Patterns"
            rows={summary?.vehiclePatterns || []}
            empty="No vehicle patterns captured yet."
            columns={[
              { key: 'vehicleNumber', label: 'Vehicle' },
              { key: 'ownerName', label: 'Owner' },
              { key: 'count', label: 'Support', render: (row) => formatNumber(row.count) },
            ]}
          />
        </div>

        <DataTable
          title="Recent Learning Events"
          rows={summary?.recentEvents || []}
          empty="No events captured yet."
          columns={[
            { key: 'createdAt', label: 'Time', render: (row) => formatDateTime(row.createdAt) },
            { key: 'supplierName', label: 'Supplier' },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'invoiceType', label: 'Mode' },
            { key: 'productName', label: 'Item' },
            { key: 'amount', label: 'Amount', render: (row) => formatNumber(row.amount) },
            { key: 'vehicleNumber', label: 'Vehicle' },
          ]}
        />
      </div>
    </main>
  );
}
