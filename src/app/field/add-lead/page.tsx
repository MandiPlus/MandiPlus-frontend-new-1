'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { createFieldLead } from '@/features/field/api';

export default function AddLeadPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [boardPhoto, setBoardPhoto] = useState<File | null>(null);
  const [form, setForm] = useState({
    businessName: '',
    customerName: '',
    businessAddress: '',
    mobileNumber: '',
    businessType: '',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (boardPhoto) {
        payload.append('boardPhoto', boardPhoto);
      }

      await createFieldLead(payload);
      setSuccess('Lead submitted to the dashboard successfully.');
      setForm({
        businessName: '',
        customerName: '',
        businessAddress: '',
        mobileNumber: '',
        businessType: '',
      });
      setBoardPhoto(null);
      window.setTimeout(() => router.push('/field/my-leads'), 900);
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to submit lead'
          : 'Failed to submit lead',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Survey capture
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Add new lead
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This form is designed for field use on mobile, but it stretches cleanly on larger screens when teams work from laptops.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Business name</span>
            <input
              required
              value={form.businessName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, businessName: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Customer name</span>
            <input
              required
              value={form.customerName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, customerName: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Business address</span>
            <textarea
              required
              rows={4}
              value={form.businessAddress}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, businessAddress: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Mobile number</span>
            <input
              required
              value={form.mobileNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, mobileNumber: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Type of business</span>
            <input
              required
              value={form.businessType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, businessType: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Board photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBoardPhoto(e.target.files?.[0] || null)}
              className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? 'Submitting...' : 'Submit to dashboard'}
            </button>
            <p className="text-sm text-slate-500">
              The admin dashboard team will review this lead, contact the customer, and schedule an appointment if needed.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
