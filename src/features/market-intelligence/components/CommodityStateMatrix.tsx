import { useMemo, useState } from 'react';
import { CommodityGeography } from '../types';
import { formatEnumLabel, formatMoney, formatNumber } from '../formatters';
import { downloadCsv } from '../exporters';

function actionClass(action: CommodityGeography['actionType']) {
  if (action === 'PUSH_SUPPLY') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (action === 'CAPTURE_DEMAND') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function CommodityStateMatrix({
  rows,
  onFocus,
}: {
  rows: CommodityGeography[];
  onFocus?: (row: CommodityGeography) => void;
}) {
  const [actionFilter, setActionFilter] = useState<CommodityGeography['actionType'] | 'ALL'>('ALL');
  const [stateFilter, setStateFilter] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');

  const states = useMemo(
    () => Array.from(new Set(rows.map((row) => row.state))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const commodities = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.commodity))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );
  const ranked = useMemo(
    () =>
      rows
        .filter((row) => {
          if (actionFilter !== 'ALL' && row.actionType !== actionFilter) return false;
          if (stateFilter && row.state !== stateFilter) return false;
          if (commodityFilter && row.commodity !== commodityFilter) return false;
          return true;
        })
        .sort((a, b) => b.opportunityScore - a.opportunityScore || b.gmv - a.gmv),
    [actionFilter, commodityFilter, rows, stateFilter],
  );
  const totals = useMemo(
    () => ({
      rows: ranked.length,
      invoices: ranked.reduce((sum, row) => sum + row.invoiceCount, 0),
      gadi: ranked.reduce((sum, row) => sum + row.vehicleCount, 0),
      gmv: ranked.reduce((sum, row) => sum + row.gmv, 0),
    }),
    [ranked],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Commodity State Matrix</h2>
            <p className="text-sm text-slate-500">
              Where each vegetable or fruit is commercially active, and what action to take.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportMatrix(ranked)}
            disabled={ranked.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            Export matrix
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Rows" value={formatNumber(totals.rows)} />
          <Metric label="Invoices" value={formatNumber(totals.invoices)} />
          <Metric label="Gadi" value={formatNumber(totals.gadi)} />
          <Metric label="GMV" value={formatMoney(totals.gmv)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <ActionButton label="All actions" active={actionFilter === 'ALL'} onClick={() => setActionFilter('ALL')} />
          <ActionButton label="Push supply" active={actionFilter === 'PUSH_SUPPLY'} onClick={() => setActionFilter('PUSH_SUPPLY')} />
          <ActionButton label="Capture demand" active={actionFilter === 'CAPTURE_DEMAND'} onClick={() => setActionFilter('CAPTURE_DEMAND')} />
          <ActionButton label="Watch" active={actionFilter === 'WATCH'} onClick={() => setActionFilter('WATCH')} />
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
            className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <select
            value={commodityFilter}
            onChange={(event) => setCommodityFilter(event.target.value)}
            className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="">All commodities</option>
            {commodities.map((commodity) => (
              <option key={commodity} value={commodity}>
                {commodity}
              </option>
            ))}
          </select>
          {(actionFilter !== 'ALL' || stateFilter || commodityFilter) && (
            <button
              type="button"
              onClick={() => {
                setActionFilter('ALL');
                setStateFilter('');
                setCommodityFilter('');
              }}
              className="border border-slate-300 bg-white px-2 py-1 text-slate-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Commodity / State</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Invoices</th>
              <th className="px-4 py-3">Gadi</th>
              <th className="px-4 py-3">GMV</th>
              <th className="px-4 py-3">Operator move</th>
              <th className="px-4 py-3">Focus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ranked.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  No commodity-state rows match the selected filters.
                </td>
              </tr>
            ) : ranked.slice(0, 24).map((row) => (
              <tr key={`${row.state}-${row.commodity}-${row.stateRank}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-950">{row.commodity}</div>
                  <div className="text-xs text-slate-500">{row.state} · rank #{row.stateRank}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {formatNumber(row.opportunityScore)}
                </td>
                <td className="px-4 py-3">
                  <span className={`border px-2 py-1 text-xs font-semibold ${actionClass(row.actionType)}`}>
                    {formatEnumLabel(row.actionType)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatNumber(row.invoiceCount)}</td>
                <td className="px-4 py-3 text-slate-700">{formatNumber(row.vehicleCount)}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(row.gmv)}</td>
                <td className="max-w-md px-4 py-3 text-slate-700">{row.suggestedAction}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onFocus?.(row)}
                    className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!onFocus}
                  >
                    Focus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
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

function exportMatrix(rows: CommodityGeography[]) {
  downloadCsv(
    'mandiplus-commodity-state-matrix',
    [
      'commodity',
      'state',
      'state_rank',
      'action',
      'opportunity_score',
      'invoices',
      'gadi',
      'gmv',
      'avg_rate',
      'intensity',
      'suggested_action',
    ],
    rows.map((row) => [
      row.commodity,
      row.state,
      row.stateRank,
      row.actionType,
      row.opportunityScore,
      row.invoiceCount,
      row.vehicleCount,
      row.gmv,
      row.avgRate,
      row.intensity,
      row.suggestedAction,
    ]),
  );
}
