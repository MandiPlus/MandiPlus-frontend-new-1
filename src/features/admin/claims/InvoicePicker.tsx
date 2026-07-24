'use client';

import {
  EligibleClaimInvoice,
  adminApi,
} from '@/features/admin/api/admin.api';
import { formatAddress, formatCurrency } from './claimUi';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function InvoicePicker({
  value,
  onChange,
}: {
  value: EligibleClaimInvoice | null;
  onChange: (invoice: EligibleClaimInvoice) => void;
}) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<EligibleClaimInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const response = await adminApi.searchEligibleClaimInvoices(search, 20);
      setOptions(response.data || []);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
        Select exact invoice
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search invoice, vehicle, supplier or buyer"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10"
        />
      </div>
      <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2">
        {loading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-500">
            Searching invoices…
          </p>
        ) : options.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-500">
            No eligible invoices found
          </p>
        ) : (
          options.map((invoice) => {
            const selected = value?.id === invoice.id;
            return (
              <button
                key={invoice.id}
                type="button"
                onClick={() => onChange(invoice)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selected
                    ? 'border-[#4309ac] bg-violet-50 ring-1 ring-[#4309ac]/10'
                    : 'border-transparent bg-white hover:border-violet-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {invoice.vehicleNumber || 'Vehicle not recorded'} ·{' '}
                      {invoice.insuredPersonName}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
                      {formatAddress(invoice.supplierAddress)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
