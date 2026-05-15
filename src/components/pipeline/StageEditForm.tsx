'use client';

import { useMemo, useState } from 'react';
import {
  PipelineStageStatus,
  UpdatePipelineStagePayload,
} from '@/features/admin/api/pipeline.api';

function formatDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseNumberValue(value: string) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function renderTextInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'datetime-local';
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
      />
    </label>
  );
}

export default function StageEditForm({
  stageNumber,
  initialData,
  initialStatus,
  onSave,
  onCancel,
}: {
  stageNumber: number;
  initialData?: Record<string, any> | null;
  initialStatus: PipelineStageStatus;
  onSave: (payload: UpdatePipelineStagePayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<PipelineStageStatus>(initialStatus);
  const [data, setData] = useState<Record<string, any>>(initialData || {});
  const [saving, setSaving] = useState(false);

  const setField = (key: string, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const stage4ChecklistComplete = useMemo(() => {
    return Boolean(data.driver_consent_taken && data.trip_created && data.tracking_link_sent);
  }, [data.driver_consent_taken, data.trip_created, data.tracking_link_sent]);

  const canMarkDone = stageNumber !== 4 || stage4ChecklistComplete;

  const handleSave = async () => {
    const payloadStatus =
      stageNumber === 4 && status === 'done' && !canMarkDone
        ? 'in_progress'
        : status;

    setSaving(true);
    try {
      await onSave({
        status: payloadStatus,
        data,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Stage status
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PipelineStageStatus)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done" disabled={!canMarkDone}>
              Done
            </option>
          </select>
        </label>
      </div>

      {stageNumber === 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {renderTextInput({
            label: 'Weighment slip ref',
            value: data.weighment_slip_ref || '',
            onChange: (value) => setField('weighment_slip_ref', value),
          })}
          {renderTextInput({
            label: 'Purchase bill ref',
            value: data.purchase_bill_ref || '',
            onChange: (value) => setField('purchase_bill_ref', value),
          })}
          {renderTextInput({
            label: 'Goods description',
            value: data.goods_description || '',
            onChange: (value) => setField('goods_description', value),
          })}
          {renderTextInput({
            label: 'Quantity',
            value: data.quantity?.toString?.() || '',
            onChange: (value) => setField('quantity', parseNumberValue(value)),
            type: 'number',
          })}
          {renderTextInput({
            label: 'Weight (kg)',
            value: data.weight_kg?.toString?.() || '',
            onChange: (value) => setField('weight_kg', parseNumberValue(value)),
            type: 'number',
          })}
        </div>
      ) : null}

      {stageNumber === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {renderTextInput({
            label: 'Invoice number',
            value: data.invoice_number || '',
            onChange: (value) => setField('invoice_number', value),
          })}
          {renderTextInput({
            label: 'Invoice amount',
            value: data.invoice_amount?.toString?.() || '',
            onChange: (value) => setField('invoice_amount', parseNumberValue(value)),
            type: 'number',
          })}
          {renderTextInput({
            label: 'Generated by',
            value: data.generated_by || '',
            onChange: (value) => setField('generated_by', value),
          })}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Sent via
            </span>
            <select
              value={data.sent_via || ''}
              onChange={(event) => setField('sent_via', event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="">Select channel</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </select>
          </label>
          {renderTextInput({
            label: 'Sent at',
            value: formatDateTimeLocal(data.sent_at),
            onChange: (value) =>
              setField('sent_at', value ? new Date(value).toISOString() : null),
            type: 'datetime-local',
          })}
        </div>
      ) : null}

      {stageNumber === 3 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {renderTextInput({
            label: 'Policy number',
            value: data.policy_number || '',
            onChange: (value) => setField('policy_number', value),
          })}
          {renderTextInput({
            label: 'Insurer name',
            value: data.insurer_name || '',
            onChange: (value) => setField('insurer_name', value),
          })}
          {renderTextInput({
            label: 'Coverage amount',
            value: data.coverage_amount?.toString?.() || '',
            onChange: (value) => setField('coverage_amount', parseNumberValue(value)),
            type: 'number',
          })}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Sent via
            </span>
            <select
              value={data.sent_via || ''}
              onChange={(event) => setField('sent_via', event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="">Select channel</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </select>
          </label>
          {renderTextInput({
            label: 'Sent at',
            value: formatDateTimeLocal(data.sent_at),
            onChange: (value) =>
              setField('sent_at', value ? new Date(value).toISOString() : null),
            type: 'datetime-local',
          })}
        </div>
      ) : null}

      {stageNumber === 4 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextInput({
              label: 'Driver name',
              value: data.driver_name || '',
              onChange: (value) => setField('driver_name', value),
            })}
            {renderTextInput({
              label: 'Driver phone',
              value: data.driver_phone || '',
              onChange: (value) => setField('driver_phone', value),
            })}
            {renderTextInput({
              label: 'Vehicle number',
              value: data.vehicle_number || '',
              onChange: (value) => setField('vehicle_number', value),
            })}
            {renderTextInput({
              label: 'Trip ID',
              value: data.trip_id || '',
              onChange: (value) => setField('trip_id', value),
            })}
            {renderTextInput({
              label: 'Tracking URL',
              value: data.tracking_url || '',
              onChange: (value) => setField('tracking_url', value),
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['driver_consent_taken', 'Driver consent taken'],
              ['trip_created', 'Trip created'],
              ['tracking_link_sent', 'Tracking link sent'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean(data[key])}
                  onChange={(event) => setField(key, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {!stage4ChecklistComplete ? (
            <p className="text-xs font-medium text-amber-700">
              All three checklist items must be checked before marking Stage 4 as done.
            </p>
          ) : null}
        </div>
      ) : null}

      {stageNumber === 5 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextInput({
              label: 'Amount due',
              value: data.amount_due?.toString?.() || '',
              onChange: (value) => setField('amount_due', parseNumberValue(value)),
              type: 'number',
            })}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Collection method
              </span>
              <select
                value={data.collection_method || ''}
                onChange={(event) => setField('collection_method', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
              >
                <option value="">Select method</option>
                <option value="call">Call</option>
                <option value="reminder">Reminder</option>
                <option value="both">Both</option>
              </select>
            </label>
            {renderTextInput({
              label: 'Amount collected',
              value: data.amount_collected?.toString?.() || '',
              onChange: (value) =>
                setField('amount_collected', parseNumberValue(value)),
              type: 'number',
            })}
            {renderTextInput({
              label: 'Payment reference',
              value: data.payment_reference || '',
              onChange: (value) => setField('payment_reference', value),
            })}
            {renderTextInput({
              label: 'Collected at',
              value: formatDateTimeLocal(data.collected_at),
              onChange: (value) =>
                setField(
                  'collected_at',
                  value ? new Date(value).toISOString() : null,
                ),
              type: 'datetime-local',
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              ['call', 'Log a call'],
              ['reminder', 'Send reminder'],
            ].map(([method, label]) => (
              <button
                key={method}
                type="button"
                onClick={() =>
                  setField('follow_up_dates', [
                    ...(Array.isArray(data.follow_up_dates)
                      ? data.follow_up_dates
                      : []),
                    {
                      method,
                      timestamp: new Date().toISOString(),
                    },
                  ])
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Follow-up log</p>
            <div className="mt-3 space-y-2">
              {(Array.isArray(data.follow_up_dates) ? data.follow_up_dates : []).length ? (
                (data.follow_up_dates as Array<{ method: string; timestamp: string }>).map(
                  (entry, index) => (
                    <div
                      key={`${entry.method}-${entry.timestamp}-${index}`}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"
                    >
                      {entry.method} • {new Date(entry.timestamp).toLocaleString('en-IN')}
                    </div>
                  ),
                )
              ) : (
                <p className="text-xs text-slate-500">No follow-ups logged yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {stageNumber === 6 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {renderTextInput({
            label: 'Last known location',
            value: data.last_known_location || '',
            onChange: (value) => setField('last_known_location', value),
          })}
          {renderTextInput({
            label: 'Estimated arrival',
            value: formatDateTimeLocal(data.estimated_arrival),
            onChange: (value) =>
              setField(
                'estimated_arrival',
                value ? new Date(value).toISOString() : null,
              ),
            type: 'datetime-local',
          })}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Vehicle status
            </span>
            <select
              value={data.vehicle_status || ''}
              onChange={(event) => setField('vehicle_status', event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="">Select status</option>
              <option value="in_transit">In transit</option>
              <option value="delayed">Delayed</option>
              <option value="arrived">Arrived</option>
            </select>
          </label>
          {renderTextInput({
            label: 'Remarks',
            value: data.remarks || '',
            onChange: (value) => setField('remarks', value),
          })}
        </div>
      ) : null}

      {stageNumber === 7 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {renderTextInput({
            label: 'Delivered at',
            value: formatDateTimeLocal(data.delivered_at),
            onChange: (value) =>
              setField('delivered_at', value ? new Date(value).toISOString() : null),
            type: 'datetime-local',
          })}
          {renderTextInput({
            label: 'Receiver name',
            value: data.receiver_name || '',
            onChange: (value) => setField('receiver_name', value),
          })}
          {renderTextInput({
            label: 'Receiver phone',
            value: data.receiver_phone || '',
            onChange: (value) => setField('receiver_phone', value),
          })}
          {renderTextInput({
            label: 'Proof of delivery URL',
            value: data.proof_of_delivery_url || '',
            onChange: (value) => setField('proof_of_delivery_url', value),
          })}
          {renderTextInput({
            label: 'Remarks',
            value: data.remarks || '',
            onChange: (value) => setField('remarks', value),
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (stageNumber === 4 && status === 'done' && !canMarkDone)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save stage'}
        </button>
      </div>
    </div>
  );
}
