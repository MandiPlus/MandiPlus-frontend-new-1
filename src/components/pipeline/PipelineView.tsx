import { PipelineShipmentDetail } from '@/features/admin/api/pipeline.api';
import StageCard from './StageCard';

export default function PipelineView({
  shipment,
  onRefresh,
}: {
  shipment: PipelineShipmentDetail;
  onRefresh: () => Promise<void>;
}) {
  const completedCount = shipment.stages.filter((stage) => stage.status === 'done').length;
  const progressPercent = (completedCount / Math.max(1, shipment.stages.length)) * 100;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pipeline progress</h2>
            <p className="mt-1 text-sm text-slate-500">
              {completedCount} of 7 stages complete
            </p>
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Current stage {shipment.currentStage}
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#334155_100%)] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-5">
        {shipment.stages.map((stage) => (
          <StageCard
            key={stage.id}
            shipment={shipment}
            stage={stage}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}
