'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { FieldLead, getMyFieldLeads } from '@/features/field/api';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<FieldLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        setLeads(await getMyFieldLeads());
      } catch (error: unknown) {
        setError(
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to load leads'
            : 'Failed to load leads',
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          My leads
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Track every lead you submitted and see where it stands in the admin
          workflow.
        </p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading leads...
        </div>
      ) : error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No leads submitted yet.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {leads.map((lead) => (
            <article
              key={lead.id}
              className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {lead.businessName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {lead.customerName}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                  {lead.currentStatus.replaceAll('_', ' ')}
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Phone</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {lead.mobileNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Business type</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {lead.businessType}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-400">Address</dt>
                  <dd className="mt-1 font-medium leading-6 text-slate-800">
                    {lead.businessAddress}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-400">Submitted</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {formatDate(lead.createdAt)}
                  </dd>
                </div>
                {lead.latestFeedbackSummary ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-400">Latest feedback summary</dt>
                    <dd className="mt-1 rounded-2xl bg-amber-50 px-3 py-3 leading-6 text-amber-900">
                      {lead.latestFeedbackSummary}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
