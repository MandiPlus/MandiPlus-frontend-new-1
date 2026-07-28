import { useMemo, useState } from 'react';
import { RegionActivity } from '../types';
import { formatMoney, formatNumber } from '../formatters';
import { downloadCsv } from '../exporters';

type StateMode = 'all' | 'high_gmv' | 'high_gadi' | 'multi_commodity' | 'watch';

export function StateCommandBoard({
  rows,
  onSelectState,
  onSelectCommodity,
}: {
  rows: RegionActivity[];
  onSelectState?: (state: string) => void;
  onSelectCommodity?: (commodity: string) => void;
}) {
  const [mode, setMode] = useState<StateMode>('all');
  const [query, setQuery] = useState('');
  const sortedRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const normalizedQuery = query.trim().toLowerCase();
          if (normalizedQuery && !row.state.toLowerCase().includes(normalizedQuery)) {
            return false;
          }
          if (mode === 'high_gmv') return row.gmv >= 1000000;
          if (mode === 'high_gadi') return row.vehicleCount >= 10;
          if (mode === 'multi_commodity') return row.activeCommodities >= 3;
          if (mode === 'watch') return row.intensity < 20 || row.vehicleCount < 3;
          return true;
        })
        .sort((a, b) => stateScore(b) - stateScore(a)),
    [mode, query, rows],
  );
  const totals = useMemo(
    () => ({
      states: sortedRows.length,
      invoices: sortedRows.reduce((sum, row) => sum + row.invoiceCount, 0),
      gadi: sortedRows.reduce((sum, row) => sum + row.vehicleCount, 0),
      gmv: sortedRows.reduce((sum, row) => sum + row.gmv, 0),
    }),
    [sortedRows],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">State Command Board</h2>
            <p className="text-sm text-slate-500">
              State-level concentration, top commodity, gadi depth, and operator move.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportStates(sortedRows)}
            disabled={sortedRows.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            Export states
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="States" value={formatNumber(totals.states)} />
          <Metric label="Invoices" value={formatNumber(totals.invoices)} />
          <Metric label="Gadi" value={formatNumber(totals.gadi)} />
          <Metric label="GMV" value={formatMoney(totals.gmv)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search state"
            className="min-w-[150px] border border-slate-300 px-2 py-1 text-slate-700"
          />
          <ModeButton label="All" active={mode === 'all'} onClick={() => setMode('all')} />
          <ModeButton label="High GMV" active={mode === 'high_gmv'} onClick={() => setMode('high_gmv')} />
          <ModeButton label="High gadi" active={mode === 'high_gadi'} onClick={() => setMode('high_gadi')} />
          <ModeButton label="Multi commodity" active={mode === 'multi_commodity'} onClick={() => setMode('multi_commodity')} />
          <ModeButton label="Watch" active={mode === 'watch'} onClick={() => setMode('watch')} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Top commodity</th>
              <th className="px-4 py-3">Invoices</th>
              <th className="px-4 py-3">Gadi</th>
              <th className="px-4 py-3">GMV</th>
              <th className="px-4 py-3">Move</th>
              <th className="px-4 py-3">Focus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  No states match the selected filters.
                </td>
              </tr>
            ) : (
              sortedRows.slice(0, 20).map((row) => {
                const action = stateAction(row);
                return (
                  <tr key={row.state}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{row.state}</div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(row.activeCommodities)} active commodities · intensity {row.intensity}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {stateScore(row)}/100
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.topCommodity || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.invoiceCount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.vehicleCount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(row.gmv)}</td>
                    <td className="max-w-[280px] px-4 py-3">
                      <span className={action.className}>{action.label}</span>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{action.note}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectState?.(row.state)}
                          disabled={!onSelectState}
                          className="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                        >
                          State
                        </button>
                        {row.topCommodity && (
                          <button
                            type="button"
                            onClick={() => onSelectCommodity?.(row.topCommodity!)}
                            disabled={!onSelectCommodity}
                            className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 disabled:opacity-40"
                          >
                            Crop
                          </button>
                        )}
                      </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
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

function stateScore(row: RegionActivity) {
  return Math.min(
    100,
    Math.round(
      Math.min(30, row.invoiceCount / 3) +
        Math.min(25, row.vehicleCount / 3) +
        Math.min(25, row.gmv / 750000) +
        Math.min(10, row.activeCommodities * 2) +
        Math.min(10, row.intensity / 10),
    ),
  );
}

function stateAction(row: RegionActivity) {
  if (row.vehicleCount >= 20 && row.gmv >= 5000000) {
    return {
      label: 'Defend lane',
      note: 'High gadi and high GMV. Keep top buyers/suppliers warm and verify rate pressure daily.',
      className: 'border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase text-emerald-800',
    };
  }
  if (row.activeCommodities >= 3 && row.vehicleCount >= 5) {
    return {
      label: 'Expand basket',
      note: 'Multiple commodities are active. Cross-sell demand and supply across the state.',
      className: 'border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold uppercase text-sky-800',
    };
  }
  if (row.vehicleCount < 3 || row.intensity < 20) {
    return {
      label: 'Watch',
      note: 'Low current depth. Use calls only if a signal or price gap confirms movement.',
      className: 'border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700',
    };
  }
  return {
    label: 'Verify demand',
    note: 'Moderate activity. Confirm if top commodity movement can repeat this week.',
    className: 'border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold uppercase text-amber-800',
  };
}

function exportStates(rows: RegionActivity[]) {
  downloadCsv(
    'mandiplus-state-command-board',
    [
      'state',
      'score',
      'action',
      'action_note',
      'top_commodity',
      'invoices',
      'gadi',
      'gmv',
      'avg_rate',
      'active_commodities',
      'intensity',
    ],
    rows.map((row) => {
      const action = stateAction(row);
      return [
        row.state,
        stateScore(row),
        action.label,
        action.note,
        row.topCommodity,
        row.invoiceCount,
        row.vehicleCount,
        row.gmv,
        row.avgRate,
        row.activeCommodities,
        row.intensity,
      ];
    }),
  );
}
