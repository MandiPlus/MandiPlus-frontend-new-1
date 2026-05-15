'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Pencil } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  PipelineShipmentDetail,
  PipelineStage,
  updatePipelineStage,
} from '@/features/admin/api/pipeline.api';
import { formatDate } from '@/features/admin/utils/format';
import { getPipelineStageName } from './pipeline.constants';
import StatusBadge from './StatusBadge';
import StageEditForm from './StageEditForm';
import DocumentUploader from './DocumentUploader';
import NotesEditor from './NotesEditor';

function summarizeData(data?: Record<string, any> | null) {
  if (!data) return [];
  return Object.entries(data).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== '' &&
      (!Array.isArray(value) || value.length > 0),
  );
}

export default function StageCard({
  shipment,
  stage,
  onRefresh,
}: {
  shipment: PipelineShipmentDetail;
  stage: PipelineStage;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(
    stage.status === 'in_progress' || shipment.currentStage === stage.stageNumber,
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setExpanded(
      stage.status === 'in_progress' || shipment.currentStage === stage.stageNumber,
    );
  }, [shipment.currentStage, stage.stageNumber, stage.status]);

  const summaryEntries = useMemo(() => summarizeData(stage.data), [stage.data]);

  const handleStageSave = async (payload: {
    status?: 'pending' | 'in_progress' | 'done';
    data?: Record<string, any>;
    notes?: string;
  }) => {
    try {
      await updatePipelineStage(shipment.id, stage.stageNumber, payload);
      toast.success(`Stage ${stage.stageNumber} updated`);
      await onRefresh();
      setEditing(false);
      setExpanded(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to update stage',
      );
    }
  };

  const handleNotesSave = async (value: string) => {
    try {
      await updatePipelineStage(shipment.id, stage.stageNumber, { notes: value });
      toast.success('Notes updated');
      await onRefresh();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to update notes',
      );
    }
  };

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-0.5 rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          >
            <ChevronDown
              className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Stage {stage.stageNumber} — {getPipelineStageName(stage.stageNumber)}
              </h3>
              <StatusBadge status={stage.status} />
              {stage.status === 'done' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {stage.updatedBy || 'Not updated yet'}
              {stage.updatedAt ? ` • ${formatDate(stage.updatedAt)}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setEditing((prev) => !prev);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          {editing ? 'Close edit' : 'Edit'}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-5 px-5 py-5">
          {editing ? (
            <StageEditForm
              stageNumber={stage.stageNumber}
              initialData={stage.data}
              initialStatus={stage.status}
              onSave={handleStageSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-800">Current data</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {summaryEntries.length ? (
                  summaryEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {key.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-2 break-words text-sm text-slate-700">
                        {Array.isArray(value)
                          ? JSON.stringify(value)
                          : typeof value === 'boolean'
                            ? value
                              ? 'Yes'
                              : 'No'
                            : String(value)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No stage data recorded yet.</p>
                )}
              </div>
            </div>
          )}

          <DocumentUploader
            shipmentId={shipment.id}
            stageNumber={stage.stageNumber}
            documents={stage.documents || []}
            onChange={onRefresh}
          />

          <NotesEditor initialValue={stage.notes} onSave={handleNotesSave} />
        </div>
      ) : null}
    </div>
  );
}
