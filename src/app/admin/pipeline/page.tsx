'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Pencil, Search, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import StageEditForm from '@/components/pipeline/StageEditForm';
import {
  getPipelineShipment,
  getPipelineShipments,
  PipelineShipmentDetail,
  PipelineShipmentStatus,
  PipelineShipmentSummary,
  updatePipelineStage,
} from '@/features/admin/api/pipeline.api';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { formatDate } from '@/features/admin/utils/format';
import { getPipelineStageName } from '@/components/pipeline/pipeline.constants';

const tabs: Array<{ label: string; value?: PipelineShipmentStatus }> = [
  { label: 'All' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'On Hold', value: 'on_hold' },
];

function statusPill(status: string) {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'on_hold') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function PipelineListPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [rows, setRows] = useState<PipelineShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<PipelineShipmentStatus | undefined>(undefined);
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, PipelineShipmentDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadShipments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getPipelineShipments({
        status,
        search: debouncedSearch || undefined,
        page: 1,
        limit: 50,
      });
      setRows(response.data || []);
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Failed to load shipments',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }

    void loadShipments();
  }, [debouncedSearch, isAuthenticated, router, status]);

  const ensureShipmentDetail = async (shipmentId: string) => {
    if (detailCache[shipmentId]) {
      return detailCache[shipmentId];
    }

    setLoadingDetailId(shipmentId);
    try {
      const detail = await getPipelineShipment(shipmentId);
      setDetailCache((prev) => ({ ...prev, [shipmentId]: detail }));
      return detail;
    } finally {
      setLoadingDetailId((current) => (current === shipmentId ? null : current));
    }
  };

  const activeDetail = expandedShipmentId ? detailCache[expandedShipmentId] : null;
  const activeStage = useMemo(
    () =>
      activeDetail?.stages?.find(
        (stage) => stage.stageNumber === activeDetail.currentStage,
      ) || null,
    [activeDetail],
  );

  const handleInlineEdit = async (shipmentId: string) => {
    if (expandedShipmentId === shipmentId) {
      setExpandedShipmentId(null);
      return;
    }

    try {
      await ensureShipmentDetail(shipmentId);
      setExpandedShipmentId(shipmentId);
    } catch (loadError: any) {
      toast.error(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Failed to load shipment details',
      );
    }
  };

  const handleStageSave = async (
    shipmentId: string,
    stageNumber: number,
    payload: {
      status?: 'pending' | 'in_progress' | 'done';
      data?: Record<string, any>;
      notes?: string;
    },
  ) => {
    try {
      const updated = await updatePipelineStage(shipmentId, stageNumber, payload);
      setDetailCache((prev) => ({ ...prev, [shipmentId]: updated }));
      toast.success(`Stage ${stageNumber} updated`);
      await loadShipments();
    } catch (saveError: any) {
      toast.error(
        saveError?.response?.data?.message ||
          saveError?.message ||
          'Failed to update stage',
      );
    }
  };

  return (
    <div className="space-y-6 py-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <Truck className="h-3.5 w-3.5" />
              Pipeline
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Shipment pipeline
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Track operational shipments across seven fixed stages.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/admin/pipeline/new')}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
          >
            New Shipment
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = status === tab.value || (!status && !tab.value);
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by invoice no, customer, or phone"
              className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.24)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Invoice No',
                  'Customer Name',
                  'Origin to Destination',
                  'Current Stage',
                  'Status',
                  'Last Updated',
                  'Actions',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading shipments...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No shipments found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isExpanded = expandedShipmentId === row.id;
                  const isInlineLoading = loadingDetailId === row.id;
                  const rowDetail = isExpanded ? activeDetail : detailCache[row.id];
                  const rowStage =
                    rowDetail?.stages?.find(
                      (stage) => stage.stageNumber === rowDetail.currentStage,
                    ) || null;

                  return (
                    <Fragment key={row.id}>
                      <tr className="transition hover:bg-slate-50">
                        <td className="border-t border-slate-200 px-4 py-4 text-sm font-semibold text-slate-900">
                          {row.displayId || 'MANUAL'}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">{row.customerName}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.customerPhone}</p>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm text-slate-700">
                          {row.origin} to {row.destination}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm text-slate-700">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Stage {row.currentStage} - {getPipelineStageName(row.currentStage)}
                          </span>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusPill(row.status)}`}
                          >
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm text-slate-600">
                          {formatDate(row.lastUpdated)}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleInlineEdit(row.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {isInlineLoading
                                ? 'Loading...'
                                : isExpanded
                                  ? 'Close editor'
                                  : 'Edit current stage'}
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/pipeline/${row.id}`)}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-95"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              Full view
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="border-t border-slate-100 bg-slate-50/60 px-5 py-5"
                          >
                            {rowStage ? (
                              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.35)]">
                                <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <h3 className="text-base font-semibold text-slate-900">
                                      {rowDetail?.displayId || row.displayId || 'MANUAL'} •{' '}
                                      {row.customerName}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                      Edit Stage {rowStage.stageNumber} -{' '}
                                      {getPipelineStageName(rowStage.stageNumber)}
                                    </p>
                                  </div>
                                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                    Inline pipeline editor
                                  </div>
                                </div>

                                <StageEditForm
                                  stageNumber={rowStage.stageNumber}
                                  initialData={rowStage.data}
                                  initialStatus={rowStage.status}
                                  onSave={(payload) =>
                                    handleStageSave(row.id, rowStage.stageNumber, payload)
                                  }
                                  onCancel={() => setExpandedShipmentId(null)}
                                />
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                Loading stage editor...
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
