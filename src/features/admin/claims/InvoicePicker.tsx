'use client';

import {
  EligibleClaimInvoice,
  adminApi,
} from '@/features/admin/api/admin.api';
import { formatAddress, formatCurrency } from './claimUi';
import { FileText, Search, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function InvoicePicker({
  value,
  onChange,
}: {
  value: EligibleClaimInvoice | null;
  onChange: (invoice: EligibleClaimInvoice) => void;
}) {
  const [searchMode, setSearchMode] = useState<'invoice' | 'vehicle' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<EligibleClaimInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const response = await adminApi.searchEligibleClaimInvoices(search, 20);
      let filtered = response.data || [];
      if (search.trim()) {
        const query = search.toLowerCase();
        if (searchMode === 'invoice') {
          filtered = filtered.filter((item) =>
            item.invoiceNumber?.toLowerCase().includes(query),
          );
        } else if (searchMode === 'vehicle') {
          filtered = filtered.filter((item) =>
            (item.vehicleNumber || '')
              .toLowerCase()
              .includes(query),
          );
        }
      }
      setOptions(filtered);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, searchMode]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800">
          Search & Select Invoice / Vehicle
        </label>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSearchMode('all')}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              searchMode === 'all'
                ? 'bg-white text-[#4309ac] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('invoice')}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              searchMode === 'invoice'
                ? 'bg-white text-[#4309ac] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-3 w-3" />
            Invoice No.
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('vehicle')}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              searchMode === 'vehicle'
                ? 'bg-white text-[#4309ac] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-3 w-3" />
            Vehicle No.
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            searchMode === 'invoice'
              ? 'Enter Invoice Number (e.g. INV-2026-005370)'
              : searchMode === 'vehicle'
                ? 'Enter Vehicle Number (e.g. AP39UD0010)'
                : 'Search by Invoice Number, Vehicle Number, Supplier or Buyer'
          }
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10"
        />
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2">
        {loading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-500">
            Searching invoices…
          </p>
        ) : options.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-500">
            No matching invoices or vehicles found
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {invoice.invoiceNumber}
                      </p>
                      {invoice.vehicleNumber && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {invoice.vehicleNumber}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Insured: <span className="font-semibold">{invoice.insuredPersonName}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                      {formatAddress(invoice.supplierAddress)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-bold text-slate-800">
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

