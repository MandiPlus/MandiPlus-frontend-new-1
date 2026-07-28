import { MarketTimelinePoint } from '../types';
import { formatMoney, formatNumber } from '../formatters';
import { downloadCsv } from '../exporters';

export function MarketTimeline({ rows }: { rows: MarketTimelinePoint[] }) {
  const maxInvoices = Math.max(...rows.map((row) => row.invoiceCount), 1);
  const maxTrips = Math.max(...rows.map((row) => row.tripCount), 1);
  const latest = rows[rows.length - 1] || null;
  const previous = rows[rows.length - 2] || null;
  const momentum =
    latest && previous
      ? latest.invoiceCount - previous.invoiceCount
      : 0;

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Period Momentum</h2>
          <p className="text-sm text-slate-500">
            Invoice, GMV, and gadi/trip movement inside the selected scope.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportTimeline(rows)}
          disabled={rows.length === 0}
          className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Export timeline
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No timeline movement found for this scope.
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <Metric label="Buckets" value={formatNumber(rows.length)} />
            <Metric
              label="Latest invoices"
              value={formatNumber(latest?.invoiceCount || 0)}
            />
            <Metric
              label="Momentum"
              value={`${momentum >= 0 ? '+' : ''}${formatNumber(momentum)}`}
            />
            <Metric label="Latest GMV" value={formatMoney(latest?.gmv || 0)} />
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.bucket} className="grid gap-2 md:grid-cols-[92px_1fr_1fr_160px] md:items-center">
                <div className="text-xs font-semibold text-slate-600">{row.bucketLabel}</div>
                <Bar
                  label={`${formatNumber(row.invoiceCount)} invoices`}
                  value={row.invoiceCount}
                  max={maxInvoices}
                  tone="emerald"
                />
                <Bar
                  label={`${formatNumber(row.tripCount)} trips · ${formatNumber(row.activeTripCount)} active`}
                  value={row.tripCount}
                  max={maxTrips}
                  tone="sky"
                />
                <div className="text-xs text-slate-500">
                  {formatMoney(row.gmv)} · {formatNumber(row.vehicleCount)} gadi · avg {formatMoney(row.avgRate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'emerald' | 'sky';
}) {
  const width = `${Math.max(3, Math.round((value / max) * 100))}%`;
  return (
    <div className="border border-slate-200 bg-slate-50 p-1">
      <div
        className={`px-2 py-1 text-xs font-semibold ${
          tone === 'emerald'
            ? 'bg-emerald-100 text-emerald-900'
            : 'bg-sky-100 text-sky-900'
        }`}
        style={{ width }}
      >
        {label}
      </div>
    </div>
  );
}

function exportTimeline(rows: MarketTimelinePoint[]) {
  downloadCsv(
    'mandiplus-period-momentum',
    [
      'bucket',
      'bucket_label',
      'invoices',
      'gmv',
      'avg_rate',
      'invoice_gadi',
      'tracked_trips',
      'active_trips',
    ],
    rows.map((row) => [
      row.bucket,
      row.bucketLabel,
      row.invoiceCount,
      row.gmv,
      row.avgRate,
      row.vehicleCount,
      row.tripCount,
      row.activeTripCount,
    ]),
  );
}
