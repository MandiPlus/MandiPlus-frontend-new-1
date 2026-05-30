'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminFieldFssaiLead,
  getFieldAdminFssaiLeads,
} from '@/features/field/admin-api';

export default function AdminFssaiLeadsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fssaiLeads, setFssaiLeads] = useState<AdminFieldFssaiLead[]>([]);
  const [fssaiSearch, setFssaiSearch] = useState('');

  const filteredFssaiLeads = useMemo(() => {
    const query = fssaiSearch.trim().toLowerCase();
    if (!query) return fssaiLeads;

    return fssaiLeads.filter((lead) =>
      [
        lead.businessName,
        lead.businessAddress,
        lead.kindOfBusiness,
        lead.companyPhone,
        lead.companyEmail,
        lead.createdByUser?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [fssaiLeads, fssaiSearch]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }

    const loadFssaiLeads = async () => {
      try {
        setLoading(true);
        setError('');
        setFssaiLeads(await getFieldAdminFssaiLeads());
      } catch (loadError: unknown) {
        setError(
          axios.isAxiosError(loadError)
            ? loadError.response?.data?.message || 'Failed to load FSSAI leads'
            : 'Failed to load FSSAI leads',
        );
      } finally {
        setLoading(false);
      }
    };

    loadFssaiLeads();
  }, [isAuthenticated, router]);

  const exportFssaiCsv = () => {
    const headers = [
      'Business Name',
      'Business Address',
      'Kind of Business',
      'Company Phone',
      'Company Email',
      'Aadhar Front',
      'Aadhar Back',
      'PAN Card',
      'Client Photo',
      'Added By',
      'Date',
    ];
    const rows = filteredFssaiLeads.map((lead) => [
      lead.businessName,
      lead.businessAddress,
      lead.kindOfBusiness,
      lead.companyPhone,
      lead.companyEmail,
      lead.aadharFrontPhotoUrl || '',
      lead.aadharBackPhotoUrl || '',
      lead.panCardPhotoUrl || '',
      lead.clientPhotoUrl || '',
      lead.createdByUser?.name || 'Field user',
      new Date(lead.createdAt).toLocaleString('en-IN'),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fssai-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading FSSAI leads...
      </div>
    );
  }

  return (
    <div className="space-y-6 py-3">
      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)] p-4 shadow-[0_26px_65px_-34px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/70 sm:p-5">
        <div className="rounded-[1.7rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                FSSAI Leads
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Certificate data collected by field users.
              </p>
            </div>
            <button
              type="button"
              onClick={exportFssaiCsv}
              className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>

          <input
            value={fssaiSearch}
            onChange={(event) => setFssaiSearch(event.target.value)}
            placeholder="Search business, phone, email, address..."
            className="mt-5 w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
          />

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white shadow-[0_18px_38px_-28px_rgba(15,23,42,0.18)]">
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] text-left">
                    {[
                      'Business Name',
                      'Address',
                      'Kind of Business',
                      'Phone',
                      'Email',
                      'Aadhar Front',
                      'Aadhar Back',
                      'PAN',
                      'Client',
                      'Submitted By',
                      'Date',
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFssaiLeads.map((lead) => {
                    const docs = [
                      lead.aadharFrontPhotoUrl,
                      lead.aadharBackPhotoUrl,
                      lead.panCardPhotoUrl,
                      lead.clientPhotoUrl,
                    ];

                    return (
                      <tr key={lead.id} className="align-top hover:bg-slate-50/60">
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm font-semibold text-slate-900">
                          {lead.businessName}
                        </td>
                        <td className="max-w-[280px] border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                          {lead.businessAddress}
                        </td>
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                          {lead.kindOfBusiness}
                        </td>
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                          {lead.companyPhone}
                        </td>
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                          {lead.companyEmail}
                        </td>
                        {docs.map((url, index) => (
                          <td
                            key={`${lead.id}-${index}`}
                            className="border-t border-slate-200/80 px-4 py-4"
                          >
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-300 hover:bg-white"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">
                                -
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                          {lead.createdByUser?.name || 'Field user'}
                        </td>
                        <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500">
                          {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredFssaiLeads.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No FSSAI leads found.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
