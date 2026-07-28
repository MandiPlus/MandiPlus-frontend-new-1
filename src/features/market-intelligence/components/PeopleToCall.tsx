import { useMemo, useState } from 'react';
import { PeopleToCallRow } from '../types';
import { formatMoney, formatNumber } from '../formatters';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';

export function PeopleToCall({ rows }: { rows: PeopleToCallRow[] }) {
  const [identityFilter, setIdentityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const identities = useMemo(
    () => uniqueValues(rows.map((row) => row.identity || 'User')).slice(0, 12),
    [rows],
  );
  const roles = useMemo(
    () => uniqueValues(rows.map((row) => row.roleCategory || 'unknown')).slice(0, 12),
    [rows],
  );
  const states = useMemo(
    () => uniqueValues(rows.map((row) => row.state).filter(Boolean)).slice(0, 18),
    [rows],
  );
  const commodities = useMemo(
    () => uniqueValues(rows.map((row) => row.recentCommodity || '').filter(Boolean)).slice(0, 18),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (identityFilter && (row.identity || 'User') !== identityFilter) return false;
        if (roleFilter && (row.roleCategory || 'unknown') !== roleFilter) return false;
        if (stateFilter && row.state !== stateFilter) return false;
        if (commodityFilter && row.recentCommodity !== commodityFilter) return false;
        if (searchQuery.trim() && !personMatchesSearch(row, searchQuery)) return false;
        return true;
      }),
    [commodityFilter, identityFilter, roleFilter, rows, searchQuery, stateFilter],
  );
  const totals = useMemo(
    () => ({
      contacts: filteredRows.length,
      invoices: filteredRows.reduce((sum, row) => sum + row.invoiceCount, 0),
      gmv: filteredRows.reduce((sum, row) => sum + row.gmv, 0),
      commodities: new Set(filteredRows.map((row) => row.recentCommodity).filter(Boolean)).size,
    }),
    [filteredRows],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">People To Call</h2>
          <p className="text-sm text-slate-500">Ranked from recent value, commodity relevance, and market activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyCallList(filteredRows)}
            disabled={filteredRows.length === 0}
            className="w-fit border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy call list
          </button>
          <button
            type="button"
            onClick={() => exportPeople(filteredRows)}
            disabled={filteredRows.length === 0}
            className="w-fit border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export filtered
          </button>
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Contacts" value={formatNumber(totals.contacts)} />
          <Metric label="Invoices" value={formatNumber(totals.invoices)} />
          <Metric label="GMV" value={formatMoney(totals.gmv)} />
          <Metric label="Commodities" value={formatNumber(totals.commodities)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, phone, state, commodity"
            className="min-w-[240px] border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-emerald-600"
          />
          <SelectFilter label="All roles" value={identityFilter} values={identities} onChange={setIdentityFilter} />
          <SelectFilter label="All categories" value={roleFilter} values={roles} onChange={setRoleFilter} />
          <SelectFilter label="All states" value={stateFilter} values={states} onChange={setStateFilter} />
          <SelectFilter label="All commodities" value={commodityFilter} values={commodities} onChange={setCommodityFilter} />
          {(identityFilter || roleFilter || stateFilter || commodityFilter || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setIdentityFilter('');
                setRoleFilter('');
                setStateFilter('');
                setCommodityFilter('');
                setSearchQuery('');
              }}
              className="border border-slate-300 bg-white px-2 py-1 text-slate-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">
            No contacts match the selected filters.
          </div>
        ) : filteredRows.slice(0, 12).map((row) => (
          <div key={row.userId} className="px-4 py-3">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-slate-950">{row.name}</div>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                    {row.roleCategory || 'unknown'}
                  </span>
                  {typeof row.priorityScore === 'number' && (
                    <span className={priorityClass(row.priorityScore)}>
                      {row.priorityScore}/100
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {row.identity || 'User'} · {row.state} · {row.recentCommodity || 'Commodity unknown'}
                  {typeof row.lastInvoiceAgeDays === 'number' && (
                    <> · {row.lastInvoiceAgeDays}d since invoice</>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">{row.reason}</div>
                <div className="mt-1 text-sm text-slate-800">
                  {row.callObjective || row.suggestedAction}
                </div>
                {!!row.qualificationQuestions?.length && (
                  <div className="mt-2 grid gap-1 text-xs text-slate-600">
                    {row.qualificationQuestions.slice(0, 3).map((question) => (
                      <div key={question} className="border border-slate-100 bg-slate-50 px-2 py-1">
                        {question}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold text-slate-950">{formatMoney(row.gmv)}</div>
                <div className="text-slate-500">{formatNumber(row.invoiceCount)} invoices</div>
                <div className="mt-2 flex justify-end gap-1 text-xs font-semibold">
                  <a
                    href={phoneHref(row.mobileNumber)}
                    className="border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                  >
                    Call
                  </a>
                  <a
                    href={whatsappHref(row.mobileNumber, row.callObjective || row.suggestedAction)}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function priorityClass(score: number) {
  if (score >= 80) {
    return 'border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-red-800';
  }
  if (score >= 60) {
    return 'border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800';
  }
  return 'border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600';
}

function SelectFilter({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
    >
      <option value="">{label}</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function personMatchesSearch(row: PeopleToCallRow, query: string) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const haystack = [
    row.name,
    row.mobileNumber,
    row.identity,
    row.roleCategory,
    row.state,
    row.recentCommodity,
    row.reason,
    row.callObjective,
    row.suggestedAction,
    ...(row.qualificationQuestions || []),
  ]
    .filter(Boolean)
    .map((value) => normalizeSearch(String(value)))
    .join(' ');
  return haystack.includes(needle);
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function copyCallList(rows: PeopleToCallRow[]) {
  if (typeof navigator === 'undefined') return;
  const text = rows
    .slice(0, 20)
    .map((row, index) => {
      const action = row.callObjective || row.suggestedAction || row.reason;
      return `${index + 1}. ${row.name} ${row.mobileNumber} · ${row.roleCategory || row.identity || 'contact'} · ${row.state} · ${row.recentCommodity || '-'} · ${action}`;
    })
    .join('\n');
  await navigator.clipboard.writeText(text);
}

function exportPeople(rows: PeopleToCallRow[]) {
  downloadCsv(
    'mandiplus-market-people-to-call',
    [
      'Name',
      'Mobile',
      'Identity',
      'Role Category',
      'State',
      'Recent Commodity',
      'Invoices',
      'GMV',
      'Last Invoice Age Days',
      'Priority Score',
      'Reason',
      'Call Objective',
      'Suggested Action',
      'Qualification Questions',
    ],
    rows.map((row) => [
      row.name,
      row.mobileNumber,
      row.identity,
      row.roleCategory,
      row.state,
      row.recentCommodity,
      row.invoiceCount,
      row.gmv,
      row.lastInvoiceAgeDays,
      row.priorityScore,
      row.reason,
      row.callObjective,
      row.suggestedAction,
      row.qualificationQuestions?.join(' | '),
    ]),
  );
}
