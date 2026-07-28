import { useMemo, useState } from 'react';
import { CommodityTrend } from '../types';
import { formatMoney, formatNumber, formatPct } from '../formatters';
import { downloadCsv } from '../exporters';

type CommodityMode = 'all' | 'price_up' | 'price_down' | 'demand_up' | 'demand_down' | 'high_value';

export function CommodityTable({ rows }: { rows: CommodityTrend[] }) {
  const [mode, setMode] = useState<CommodityMode>('all');
  const [query, setQuery] = useState('');

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const normalizedQuery = query.trim().toLowerCase();
          if (normalizedQuery && !row.commodity.toLowerCase().includes(normalizedQuery)) {
            return false;
          }
          if (mode === 'price_up') return row.rateChangePct > 0;
          if (mode === 'price_down') return row.rateChangePct < 0;
          if (mode === 'demand_up') return row.invoiceChangePct > 0;
          if (mode === 'demand_down') return row.invoiceChangePct < 0;
          if (mode === 'high_value') return row.gmv >= 1000000 || row.invoiceCount >= 20;
          return true;
        })
        .sort((a, b) => commodityScore(b) - commodityScore(a)),
    [mode, query, rows],
  );
  const totals = useMemo(
    () => ({
      commodities: filteredRows.length,
      invoices: filteredRows.reduce((sum, row) => sum + row.invoiceCount, 0),
      gadi: filteredRows.reduce((sum, row) => sum + row.vehicleCount, 0),
      gmv: filteredRows.reduce((sum, row) => sum + row.gmv, 0),
    }),
    [filteredRows],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Commodity Movement</h2>
            <p className="text-sm text-slate-500">Invoice-rate movement vs previous period.</p>
          </div>
          <button
            type="button"
            onClick={() => exportCommodities(filteredRows)}
            disabled={filteredRows.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            Export commodities
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Commodities" value={formatNumber(totals.commodities)} />
          <Metric label="Invoices" value={formatNumber(totals.invoices)} />
          <Metric label="Gadi" value={formatNumber(totals.gadi)} />
          <Metric label="GMV" value={formatMoney(totals.gmv)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commodity"
            className="min-w-[160px] border border-slate-300 px-2 py-1 text-slate-700"
          />
          <ModeButton label="All" active={mode === 'all'} onClick={() => setMode('all')} />
          <ModeButton label="Price up" active={mode === 'price_up'} onClick={() => setMode('price_up')} />
          <ModeButton label="Price down" active={mode === 'price_down'} onClick={() => setMode('price_down')} />
          <ModeButton label="Demand up" active={mode === 'demand_up'} onClick={() => setMode('demand_up')} />
          <ModeButton label="Demand down" active={mode === 'demand_down'} onClick={() => setMode('demand_down')} />
          <ModeButton label="High value" active={mode === 'high_value'} onClick={() => setMode('high_value')} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Invoices</th>
              <th className="px-4 py-3">Gadi</th>
              <th className="px-4 py-3">GMV</th>
              <th className="px-4 py-3">Avg Rate</th>
              <th className="px-4 py-3">Rate Move</th>
              <th className="px-4 py-3">Demand Move</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  No commodities match the selected filters.
                </td>
              </tr>
            ) : (
              filteredRows.slice(0, 18).map((row) => {
                const action = commodityAction(row);
                return (
                  <tr key={row.commodity}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{row.commodity}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Score {commodityScore(row)}/100 · prev invoices {formatNumber(row.previousInvoiceCount)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={action.className}>{action.label}</span>
                      <div className="mt-1 max-w-[220px] text-xs leading-5 text-slate-500">
                        {action.note}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.invoiceCount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.vehicleCount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(row.gmv)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(row.avgRate)}</td>
                    <td className={`px-4 py-3 font-semibold ${row.rateChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatPct(row.rateChangePct)}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${row.invoiceChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatPct(row.invoiceChangePct)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
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

function commodityScore(row: CommodityTrend) {
  return Math.min(
    100,
    Math.round(
      Math.min(30, row.invoiceCount * 2) +
        Math.min(20, row.vehicleCount * 3) +
        Math.min(25, row.gmv / 500000) +
        Math.min(15, Math.abs(row.rateChangePct) / 4) +
        Math.min(10, Math.abs(row.invoiceChangePct) / 8),
    ),
  );
}

function commodityAction(row: CommodityTrend) {
  if (row.rateChangePct >= 10 && row.invoiceChangePct >= 10) {
    return {
      label: 'Push supply',
      note: 'Demand and rate both moved up. Verify availability and line up matching buyers.',
      className: 'border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase text-emerald-800',
    };
  }
  if (row.rateChangePct >= 10 && row.invoiceChangePct < 0) {
    return {
      label: 'Check shortage',
      note: 'Rate moved up while demand count fell. Validate supply shortage or fewer high-value deals.',
      className: 'border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold uppercase text-amber-800',
    };
  }
  if (row.rateChangePct < -8 && row.invoiceChangePct >= 10) {
    return {
      label: 'Capture demand',
      note: 'More transactions at softer rate. Push volume and improve buyer conversion.',
      className: 'border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold uppercase text-sky-800',
    };
  }
  if (row.rateChangePct < -8 && row.invoiceChangePct < 0) {
    return {
      label: 'Watch decline',
      note: 'Rate and activity both softened. Avoid over-calling until field signal confirms.',
      className: 'border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold uppercase text-red-800',
    };
  }
  return {
    label: 'Verify',
    note: 'Movement is present but not decisive. Use calls or external prices before acting.',
    className: 'border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700',
  };
}

function exportCommodities(rows: CommodityTrend[]) {
  downloadCsv(
    'mandiplus-commodity-movement',
    [
      'commodity',
      'action',
      'action_note',
      'score',
      'invoices',
      'previous_invoices',
      'gadi',
      'gmv',
      'avg_rate',
      'previous_avg_rate',
      'rate_change_pct',
      'invoice_change_pct',
    ],
    rows.map((row) => {
      const action = commodityAction(row);
      return [
        row.commodity,
        action.label,
        action.note,
        commodityScore(row),
        row.invoiceCount,
        row.previousInvoiceCount,
        row.vehicleCount,
        row.gmv,
        row.avgRate,
        row.previousAvgRate,
        row.rateChangePct,
        row.invoiceChangePct,
      ];
    }),
  );
}
