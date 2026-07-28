import { ExternalPriceIntelligence } from '../types';
import { formatMoney, formatNumber } from '../formatters';

export function ExternalPricePanel({ rows }: { rows: ExternalPriceIntelligence[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">External Price Evidence</h2>
        <p className="text-sm text-slate-500">
          Persisted public mandi observations, ready to corroborate internal invoice-rate signals.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Modal</th>
              <th className="px-4 py-3">Range</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={7}>
                  No external price observations yet. Run source ingestion from Source Lab after migration.
                </td>
              </tr>
            ) : (
              rows.slice(0, 12).map((row) => (
                <tr key={`${row.commodity}-${row.state}-${row.market}`}>
                  <td className="px-4 py-3 font-medium text-slate-950">{row.commodity}</td>
                  <td className="px-4 py-3 text-slate-700">{row.market}</td>
                  <td className="px-4 py-3 text-slate-700">{row.state}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatMoney(row.avgModalPrice)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatMoney(row.minPrice)} - {formatMoney(row.maxPrice)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatNumber(row.observations)}</td>
                  <td className="px-4 py-3 text-slate-500">{row.sourceName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
