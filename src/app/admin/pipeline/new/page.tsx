'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { createPipelineShipment } from '@/features/admin/api/pipeline.api';

const shipmentFields: Array<{
  key: 'customerName' | 'customerPhone' | 'customerEmail' | 'origin' | 'destination';
  label: string;
  required: boolean;
}> = [
  { key: 'customerName', label: 'Customer name', required: true },
  { key: 'customerPhone', label: 'Customer phone', required: true },
  { key: 'customerEmail', label: 'Customer email', required: false },
  { key: 'origin', label: 'Origin', required: true },
  { key: 'destination', label: 'Destination', required: true },
];

export default function NewPipelineShipmentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    origin: '',
    destination: '',
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const shipment = await createPipelineShipment({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        origin: form.origin,
        destination: form.destination,
      });
      toast.success('Shipment created');
      router.push(`/admin/pipeline/${shipment.id}`);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to create shipment',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-4">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.24)]">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          New shipment
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Create a shipment and initialize all seven pipeline stages.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
          {shipmentFields.map(({ key, label, required }) => (
            <label key={key} className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                {label}
              </span>
              <input
                required={required}
                type={key === 'customerEmail' ? 'email' : 'text'}
                value={form[key]}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </label>
          ))}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/pipeline')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
