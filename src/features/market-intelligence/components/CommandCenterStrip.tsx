import { MarketPulseData } from '../types';
import { formatMoney, formatNumber } from '../formatters';

export function CommandCenterStrip({ data }: { data: MarketPulseData }) {
  const topCommodity = data.commodityTrends[0] || null;
  const topState = data.regionActivity[0] || null;
  const topLane = data.routeActivity[0] || null;
  const topDeal = data.opportunities[0] || null;
  const topPerson = data.peopleToCall[0] || null;
  const topSignal = data.signals[0] || null;

  const cards = [
    {
      label: 'Crop to act',
      value: topCommodity?.commodity || '-',
      detail: topCommodity
        ? `${formatNumber(topCommodity.vehicleCount)} gadi · ${formatMoney(topCommodity.gmv)}`
        : 'No commodity movement',
    },
    {
      label: 'State to defend',
      value: topState?.state || '-',
      detail: topState
        ? `${topState.topCommodity || 'Mixed'} · ${formatNumber(topState.vehicleCount)} gadi`
        : 'No state activity',
    },
    {
      label: 'Live lane',
      value: topLane ? `${topLane.source} -> ${topLane.destination}` : '-',
      detail: topLane
        ? `${formatNumber(topLane.vehicleCount)} gadi · ${formatNumber(topLane.activeTrips)} active`
        : 'No route movement',
    },
    {
      label: 'Deal to chase',
      value: topDeal?.commodity || topDeal?.title || '-',
      detail: topDeal
        ? `${topDeal.priority} · ${formatMoney(topDeal.commercialValue)} · ${topDeal.score}/100`
        : 'No ranked opportunity',
    },
    {
      label: 'First call',
      value: topPerson?.name || '-',
      detail: topPerson
        ? `${topPerson.roleCategory || topPerson.identity || 'contact'} · ${topPerson.priorityScore || 0}/100`
        : 'No call target',
    },
    {
      label: 'Top signal',
      value: topSignal?.title || '-',
      detail: topSignal
        ? `${topSignal.severity} · ${topSignal.type.replace(/_/g, ' ')} · ${topSignal.score}/100`
        : 'No signal',
    },
  ];

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Command Center</h2>
        <p className="text-sm text-slate-500">
          Fast read for the current scope: what to chase, where, on which lane, and who to call.
        </p>
      </div>
      <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className="mt-1 min-h-10 text-sm font-semibold leading-5 text-slate-950">
              {card.value}
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
