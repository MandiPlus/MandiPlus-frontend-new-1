'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Save, Truck } from 'lucide-react';
import {
  adminApi,
  TenderCoconutAppPricing,
} from '@/features/admin/api/admin.api';

const DEFAULT_PRICING: TenderCoconutAppPricing = {
  pricingVersion: 1,
  amount25Ton: 130000,
  amount30Ton: 140000,
  updatedAt: null,
};

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Using default rates';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved';
  return `Updated ${date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 border-b border-slate-100 py-4 last:border-b-0 sm:grid-cols-[1fr_220px] sm:items-center">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
          Rs
        </span>
        <input
          type="number"
          min="0"
          max="5000000"
          step="1"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-right text-base font-semibold text-slate-950 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-violet-100"
        />
      </span>
    </label>
  );
}

export default function AdminAppSettingsPage() {
  const [savedPricing, setSavedPricing] =
    useState<TenderCoconutAppPricing>(DEFAULT_PRICING);
  const [amount25Ton, setAmount25Ton] = useState('130000');
  const [amount30Ton, setAmount30Ton] = useState('140000');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void adminApi.getAppSettings().then((response) => {
      if (!active) return;
      if (!response.success || !response.data?.tenderCoconut) {
        setError(response.message || 'App settings could not be loaded.');
        setLoading(false);
        return;
      }
      const pricing = response.data.tenderCoconut;
      setSavedPricing(pricing);
      setAmount25Ton(String(pricing.amount25Ton));
      setAmount30Ton(String(pricing.amount30Ton));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const numeric25 = Number(amount25Ton);
  const numeric30 = Number(amount30Ton);
  const valid =
    Number.isFinite(numeric25) &&
    numeric25 >= 0 &&
    Number.isFinite(numeric30) &&
    numeric30 >= 0;
  const dirty = useMemo(
    () =>
      numeric25 !== Number(savedPricing.amount25Ton) ||
      numeric30 !== Number(savedPricing.amount30Ton),
    [numeric25, numeric30, savedPricing],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setSaved(false);
    setError('');
    const response = await adminApi.updateTenderCoconutLogistics({
      amount25Ton: numeric25,
      amount30Ton: numeric30,
    });
    setSaving(false);
    if (!response.success || !response.data?.tenderCoconut) {
      setError(response.message || 'Settings could not be saved.');
      return;
    }
    setSavedPricing(response.data.tenderCoconut);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <main className="min-h-full bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="text-2xl font-semibold text-slate-950">App Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer app pricing controls.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-50 text-[#4309ac]">
              <Truck size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Tender Coconut
              </h2>
              <p className="text-xs text-slate-500">
                {formatUpdatedAt(savedPricing.updatedAt)}
              </p>
            </div>
          </div>

          <div className="px-5">
            {loading ? (
              <div className="flex h-36 items-center justify-center text-slate-400">
                <LoaderCircle className="animate-spin" size={22} />
              </div>
            ) : (
              <>
                <AmountField
                  label="25 ton vehicle"
                  value={amount25Ton}
                  onChange={setAmount25Ton}
                />
                <AmountField
                  label="30 ton vehicle"
                  value={amount30Ton}
                  onChange={setAmount30Ton}
                />
              </>
            )}
          </div>

          <div className="flex min-h-16 items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              type="submit"
              disabled={loading || saving || !valid || !dirty}
              className="ml-auto inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md bg-[#4309ac] px-4 text-sm font-semibold text-white transition hover:bg-[#360786] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : saved ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {saving ? 'Saving' : saved ? 'Saved' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
