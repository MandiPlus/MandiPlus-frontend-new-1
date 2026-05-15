import { PipelineStageStatus } from '@/features/admin/api/pipeline.api';

function getStatusClasses(status: PipelineStageStatus) {
  if (status === 'done') {
    return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  }
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-700 ring-amber-200';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function StatusBadge({
  status,
}: {
  status: PipelineStageStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ${getStatusClasses(status)}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
