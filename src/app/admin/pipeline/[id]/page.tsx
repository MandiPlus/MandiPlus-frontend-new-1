'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AuditTrail from '@/components/pipeline/AuditTrail';
import PipelineView from '@/components/pipeline/PipelineView';
import {
  getPipelineAuditTrail,
  getPipelineShipment,
  PipelineAuditEntry,
  PipelineShipmentDetail,
} from '@/features/admin/api/pipeline.api';
import { formatDate } from '@/features/admin/utils/format';

export default function PipelineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const shipmentId = String(params?.id || '');
  const [shipment, setShipment] = useState<PipelineShipmentDetail | null>(null);
  const [auditEntries, setAuditEntries] = useState<PipelineAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!shipmentId) return;
    try {
      setLoading(true);
      setError('');
      const [shipmentResponse, auditResponse] = await Promise.all([
        getPipelineShipment(shipmentId),
        getPipelineAuditTrail(shipmentId),
      ]);
      setShipment(shipmentResponse);
      setAuditEntries(auditResponse || []);
    } catch (loadError: any) {
      const message =
        loadError?.response?.data?.message ||
        loadError?.message ||
        'Failed to load shipment';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white px-5 py-8 text-sm text-slate-500">
        Loading shipment pipeline...
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        {error || 'Shipment not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.24)]">
        <button
          type="button"
          onClick={() => router.push('/admin/pipeline')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shipments
        </button>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Shipment {shipment.displayId || 'MANUAL'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Created {formatDate(shipment.createdAt)}
            </p>
          </div>
          <div className="grid gap-3 rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Customer
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {shipment.customerName}
              </p>
              <p className="mt-1 text-sm text-slate-600">{shipment.customerPhone}</p>
              {shipment.customerEmail ? (
                <p className="mt-1 text-sm text-slate-600">{shipment.customerEmail}</p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Route
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {shipment.origin} → {shipment.destination}
              </p>
              <p className="mt-1 text-sm text-slate-600 capitalize">
                Status: {shipment.status.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PipelineView shipment={shipment} onRefresh={load} />
      <AuditTrail entries={auditEntries} />
    </div>
  );
}
