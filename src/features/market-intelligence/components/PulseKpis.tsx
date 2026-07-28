import { MarketPulseData } from '../types';
import { formatMoney, formatNumber } from '../formatters';

export function PulseKpis({ data }: { data: MarketPulseData }) {
  const items = [
    { label: 'Invoices', value: formatNumber(data.totals.invoiceCount) },
    { label: 'GMV', value: formatMoney(data.totals.gmv) },
    { label: 'Premium', value: formatMoney(data.totals.premium) },
    { label: 'Invoice Gadi', value: formatNumber(data.totals.vehicleCount) },
    { label: 'Tracked Trips', value: formatNumber(data.totals.tripCount) },
    { label: 'Active Trips', value: formatNumber(data.totals.activeTripCount) },
    { label: 'Active People', value: formatNumber(data.totals.activePeople) },
    { label: 'Commodities', value: formatNumber(data.totals.commodityCount) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((item) => (
        <div key={item.label} className="border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
