'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, ArrivalReportRow } from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ArrivalReportsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAdmin();
  const [rows, setRows] = useState<ArrivalReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.getArrivalReports();
      if (!response.success) {
        throw new Error(response.message || 'Failed to load arrival reports');
      }
      setRows(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load arrival reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    loadReports();
  }, [authLoading, isAuthenticated, router]);

  const handleRunLatest = async () => {
    try {
      setRunning(true);
      setError('');
      const response = await adminApi.runLatestArrivalReport();
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate latest report');
      }
      await loadReports();
    } catch (err: any) {
      setError(err.message || 'Failed to generate latest report');
    } finally {
      setRunning(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Arrival Reports</h1>
            <p className="mt-1 text-sm text-gray-600">
              Daily reports are created for invoices from exactly five days earlier and sent to admin WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunLatest}
            disabled={running}
            className="inline-flex items-center justify-center rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35078a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? 'Generating...' : 'Run Latest Report'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Report Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Invoices</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">WhatsApp</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Sent At</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Files</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No arrival reports generated yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {formatDate(row.reportDate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.invoiceCount}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.whatsappNumber || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatDateTime(row.whatsappSentAt)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {row.excelUrl && (
                            <a
                              href={row.excelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Excel
                            </a>
                          )}
                          {row.pdfUrl && (
                            <a
                              href={row.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {row.generationError ? (
                          <span className="text-red-600">{row.generationError}</span>
                        ) : row.whatsappSent ? (
                          <span className="font-medium text-emerald-700">Generated and sent</span>
                        ) : (
                          <span className="font-medium text-amber-700">Generated</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
