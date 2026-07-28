import { PriceGapIntelligence } from '../types';
import { formatMoney, formatNumber } from '../formatters';

function directionLabel(direction: PriceGapIntelligence['direction']) {
  return direction === 'PUBLIC_PREMIUM' ? 'Public premium' : 'Internal premium';
}

function directionClass(direction: PriceGapIntelligence['direction']) {
  return direction === 'PUBLIC_PREMIUM'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
}

export function PriceGapPanel({ rows }: { rows: PriceGapIntelligence[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Internal vs Public Price Gaps</h2>
        <p className="text-sm text-slate-500">
          MandiPlus invoice-rate reality compared against public mandi modal prices by commodity and state.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">State / market</th>
              <th className="px-4 py-3">Internal</th>
              <th className="px-4 py-3">Public</th>
              <th className="px-4 py-3">Gap</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={7}>
                  No price gaps yet. This will populate after public price observations match internal commodity/state activity.
                </td>
              </tr>
            ) : (
              rows.slice(0, 12).map((row) => (
                <tr key={`${row.commodity}-${row.state}-${row.market}-${row.direction}`} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-950">{row.commodity}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{row.state}</div>
                    <div className="text-xs text-slate-500">{row.market}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    {formatMoney(row.internalAvgRate)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-semibold text-slate-950">{formatMoney(row.publicModalPrice)}</div>
                    <div className="text-xs text-slate-500">{row.sourceName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex border px-2 py-1 text-xs font-semibold ${directionClass(row.direction)}`}>
                      {directionLabel(row.direction)} · {row.gapPct.toFixed(1)}%
                    </span>
                    <div className="mt-1 text-xs text-slate-500">{formatMoney(Math.abs(row.gapAmount))}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{formatNumber(row.invoiceCount)} invoices</div>
                    <div className="text-xs text-slate-500">
                      {formatNumber(row.vehicleCount)} gadi · {formatNumber(row.externalObservations)} public obs.
                    </div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-600">
                    {row.recommendedAction}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
