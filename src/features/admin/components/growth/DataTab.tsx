'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type GrowthBatch,
  type GrowthBatchRows,
  type GrowthContactTimeline,
  type GrowthDataSummary,
} from '@/features/admin/api/admin.api';
import { StatCard, Td, Th, dateTime, phoneNumber, pct, rupees } from './ui';

/**
 * How a number's standing reads at a glance. Colour carries the meaning that
 * matters when scanning a list of five hundred: green is proven reachable,
 * red is money already wasted, grey is simply untested — not bad news.
 */
const STATE_STYLE: Record<string, { label: string; className: string; title: string }> = {
  REACHABLE: {
    label: 'Reachable',
    className: 'bg-emerald-100 text-emerald-800',
    title: 'A message has been delivered here, or they have messaged us',
  },
  NOT_ON_WHATSAPP: {
    label: 'Not on WhatsApp',
    className: 'bg-red-100 text-red-800',
    title: 'Meta returned 131026 — sending again costs full price to learn the same thing',
  },
  CAPPED: {
    label: 'Cap-blocked',
    className: 'bg-amber-100 text-amber-800',
    title: '131049 — Meta’s per-user marketing cap, shared across all businesses',
  },
  UNDELIVERED: {
    label: 'Undelivered',
    className: 'bg-orange-100 text-orange-800',
    title: 'Failed for some other reason',
  },
  PENDING: {
    label: 'No callback',
    className: 'bg-sky-100 text-sky-800',
    title: 'Sent, but no delivery callback arrived — not evidence of failure',
  },
  UNKNOWN: {
    label: 'Untested',
    className: 'bg-gray-100 text-gray-600',
    title: 'Never messaged — roughly a third of a cold list is not on WhatsApp',
  },
};

function StateChip({ state }: { state: string }) {
  const style = STATE_STYLE[state] || STATE_STYLE.UNKNOWN;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
      title={style.title}
    >
      {style.label}
    </span>
  );
}

const CONSENT_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'EXPLICIT_OPT_IN', label: 'Explicit opt-in' },
  { value: 'EXISTING_CUSTOMER', label: 'Existing customer' },
  { value: 'FIELD_VISIT', label: 'Met in person / field visit' },
  { value: 'REFERRAL', label: 'Referred by a customer' },
  { value: 'PUBLIC_DIRECTORY', label: 'Public directory listing' },
  { value: 'SCRAPED', label: 'Scraped — no basis' },
];

function ConsentChip({ basis }: { basis: string | null }) {
  if (!basis) {
    return (
      <span
        className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
        title="No recorded basis for messaging this list"
      >
        No basis
      </span>
    );
  }
  const label =
    CONSENT_OPTIONS.find((option) => option.value === basis)?.label || basis;
  const weak = basis === 'SCRAPED' || basis === 'PUBLIC_DIRECTORY';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        weak ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
      }`}
    >
      {label}
    </span>
  );
}

/** Level 3 — one number's whole history, in the order it happened. */
function ContactDrawer({
  phone,
  onClose,
}: {
  phone: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<GrowthContactTimeline | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await adminApi.getGrowthContact(phone));
  }, [phone]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleOptOut = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await adminApi.setGrowthOptOut(phone, !data.standing.optedOut);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {data?.identity?.name || phoneNumber(phone)}
            </p>
            <p className="text-sm text-gray-500">{phoneNumber(phone)}</p>
            {data?.identity?.batchLabel ? (
              <p className="mt-1 text-xs text-gray-500">
                From list “{data.identity.batchLabel}”
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {!data ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 border-b border-gray-200 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Standing</p>
                <div className="mt-1">
                  <StateChip state={data.standing.state} />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Messages</p>
                <p className="mt-1 text-gray-900">
                  {data.standing.sendCount} sent · {data.standing.failureCount} failed
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Last delivered
                </p>
                <p className="mt-1 text-gray-900">
                  {dateTime(data.standing.lastDeliveredAt)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Last reply
                </p>
                <p className="mt-1 text-gray-900">
                  {dateTime(data.standing.lastInboundAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
              <div className="text-sm">
                {data.standing.optedOut ? (
                  <>
                    <p className="font-semibold text-red-700">Opted out</p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {data.standing.optOutSource === 'REPLY'
                        ? `Detected from their reply: “${data.standing.optOutEvidence}”`
                        : data.standing.optOutEvidence}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-700">Receiving messages</p>
                )}
              </div>
              <button
                onClick={toggleOptOut}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                {data.standing.optedOut ? 'Allow messages again' : 'Stop messaging'}
              </button>
            </div>

            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                History
              </p>
              {data.events.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {data.events.map((event, index) => (
                    <li
                      key={`${event.at}-${index}`}
                      className="border-l-2 border-gray-200 pl-3"
                    >
                      <p className="text-xs text-gray-500">
                        {dateTime(event.at)} · {event.kind}
                        {event.detail ? ` · ${event.detail}` : ''}
                        {event.status ? ` · ${event.status}` : ''}
                      </p>
                      {event.body ? (
                        <p className="mt-0.5 break-words text-sm text-gray-800">
                          {event.body}
                        </p>
                      ) : null}
                      {event.errorText ? (
                        <p className="mt-0.5 break-words text-xs text-red-600">
                          {event.errorText}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Level 2 — the rows inside one list, and what can be done with them. */
function BatchDetail({
  batch,
  onBack,
  onSend,
}: {
  batch: GrowthBatch;
  onBack: () => void;
  onSend: (phones: string[], label: string) => void;
}) {
  const [data, setData] = useState<GrowthBatchRows | null>(null);
  const [overlap, setOverlap] = useState<
    Array<{ id: string; label: string; shared: number }>
  >([]);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [consent, setConsent] = useState(batch.consentBasis || '');
  const [savingConsent, setSavingConsent] = useState(false);
  const [holdoutBusy, setHoldoutBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await adminApi.getGrowthBatchRows(batch.id, {
      search: search || undefined,
      state: state || undefined,
      limit: 300,
    });
    setData(rows);
  }, [batch.id, search, state]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void adminApi.getGrowthBatchOverlap(batch.id).then(setOverlap);
  }, [batch.id]);

  const rows = data?.rows || [];
  const selectableRows = rows.filter((row) => row.phone && !row.optedOut);

  const toggle = (phone: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const saveConsent = async () => {
    setSavingConsent(true);
    try {
      await adminApi.updateGrowthBatch(batch.id, {
        consentBasis: consent || null,
      });
      setNotice('Consent basis saved.');
    } finally {
      setSavingConsent(false);
    }
  };

  const assignHoldout = async () => {
    setHoldoutBusy(true);
    try {
      const result = await adminApi.assignGrowthHoldout(batch.id, 10);
      setNotice(
        result.held > 0
          ? `${result.held} leads held back as a control group.`
          : 'Nothing eligible — a holdout can only come from leads never messaged.',
      );
      await load();
    } finally {
      setHoldoutBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← All lists
          </button>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            {batch.label}
          </h2>
          <p className="text-sm text-gray-500">
            {batch.leads} leads · added {dateTime(batch.createdAt)}
            {batch.createdBy ? ` by ${batch.createdBy}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={assignHoldout}
            disabled={holdoutBusy}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Reserve 10% of the never-messaged leads as a control group"
          >
            Hold back 10%
          </button>
          <button
            onClick={() =>
              onSend(
                Array.from(selected),
                `${batch.label} — ${selected.size} selected`,
              )
            }
            disabled={selected.size === 0}
            className="rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send to {selected.size || 'selected'}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reachable"
          value={`${batch.reachable}`}
          sub={`${pct(batch.reachableRate)} of the list`}
          tone="good"
        />
        <StatCard
          label="Not on WhatsApp"
          value={`${batch.notOnWhatsapp}`}
          sub={`${pct(batch.notOnWhatsappRate)} — paid for, unreachable`}
          tone={batch.notOnWhatsapp > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="Spent"
          value={rupees(batch.spendPaise)}
          sub={
            batch.costPerReplyPaise
              ? `${rupees(batch.costPerReplyPaise)} per reply`
              : `${batch.sends} messages sent`
          }
        />
        <StatCard
          label="Converted"
          value={`${batch.converted}`}
          sub={
            batch.costPerConversionPaise
              ? `${rupees(batch.costPerConversionPaise)} each`
              : 'no conversions yet'
          }
          tone={batch.converted > 0 ? 'brand' : 'default'}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              What lets us message this list
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={consent}
                onChange={(event) => setConsent(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CONSENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={saveConsent}
                disabled={savingConsent || consent === (batch.consentBasis || '')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
          {overlap.length > 0 ? (
            <div className="min-w-[240px] flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Shares numbers with
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {overlap.map((other) => (
                  <span
                    key={other.id}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                    title="Messaging the same number twice inside a week raises cap-blocking"
                  >
                    {other.label} · {other.shared}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or number"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Every standing</option>
          {Object.entries(STATE_STYLE).map(([key, style]) => (
            <option key={key} value={key}>
              {style.label}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            setSelected(
              selected.size === selectableRows.length
                ? new Set()
                : new Set(selectableRows.map((row) => row.phone as string)),
            )
          }
          className="text-sm text-[#4309ac] hover:underline"
        >
          {selected.size === selectableRows.length && selectableRows.length > 0
            ? 'Clear selection'
            : `Select all ${selectableRows.length} shown`}
        </button>
        <span className="text-sm text-gray-500">
          {data ? `${rows.length} of ${data.total} rows` : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th> </Th>
                <Th>Name</Th>
                <Th>Number</Th>
                <Th>Standing</Th>
                <Th>Lead status</Th>
                <Th>Mandi / crop</Th>
                <Th right>Calls</Th>
                <Th>Last message</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <Td>
                    <input
                      type="checkbox"
                      checked={row.phone ? selected.has(row.phone) : false}
                      disabled={!row.phone || row.optedOut}
                      onChange={() => row.phone && toggle(row.phone)}
                    />
                  </Td>
                  <Td>
                    <span className="font-medium">{row.name}</span>
                    {row.isHoldout ? (
                      <span
                        className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600"
                        title="Held back as a control group — never messaged"
                      >
                        HELD
                      </span>
                    ) : null}
                    {row.isCustomer ? (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        CUSTOMER
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {row.phone ? (
                      <button
                        onClick={() => setOpenPhone(row.phone as string)}
                        className="text-[#4309ac] hover:underline"
                      >
                        {phoneNumber(row.phone)}
                      </button>
                    ) : (
                      <span className="text-gray-400">no number</span>
                    )}
                  </Td>
                  <Td>
                    <StateChip state={row.state} />
                    {row.optedOut ? (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                        Opted out
                      </span>
                    ) : null}
                  </Td>
                  <Td muted>{row.status}</Td>
                  <Td muted>
                    {[row.region, row.commodityCode].filter(Boolean).join(' · ') || '—'}
                  </Td>
                  <Td right muted>
                    {row.attemptCount}
                  </Td>
                  <Td muted>{dateTime(row.lastSentAt)}</Td>
                  <Td muted>{row.assignee || '—'}</Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-gray-500">
                    No rows match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {openPhone ? (
        <ContactDrawer phone={openPhone} onClose={() => setOpenPhone(null)} />
      ) : null}
    </div>
  );
}

/**
 * Level 1 — every list, scored. The question this table answers is not "how
 * did the campaign do" but "was this way of finding traders worth paying for".
 */
export default function DataTab({
  onSend,
}: {
  onSend: (phones: string[], label: string) => void;
}) {
  const [summary, setSummary] = useState<GrowthDataSummary | null>(null);
  const [batches, setBatches] = useState<GrowthBatch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openBatch, setOpenBatch] = useState<GrowthBatch | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryData, batchData] = await Promise.all([
      adminApi.getGrowthDataSummary(),
      adminApi.getGrowthBatches(search || undefined),
    ]);
    setSummary(summaryData);
    setBatches(batchData);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshLedger = async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      const result = await adminApi.refreshGrowthLedger();
      setNotice(
        `Ledger rebuilt from message history: ${result.contacts} contacts` +
          (result.optOutsAdded > 0
            ? `, ${result.optOutsAdded} new opt-outs found in replies`
            : ''),
      );
      await load();
    } catch {
      setNotice('Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  if (openBatch) {
    return (
      <BatchDetail
        batch={openBatch}
        onBack={() => {
          setOpenBatch(null);
          void load();
        }}
        onSend={onSend}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Numbers we know"
          value={`${summary?.knownContacts ?? 0}`}
          sub={`${summary?.reachable ?? 0} proven reachable`}
        />
        <StatCard
          label="Not on WhatsApp"
          value={`${summary?.notOnWhatsapp ?? 0}`}
          sub={`${pct(summary?.notOnWhatsappRate)} of everything ever messaged`}
          tone="warn"
        />
        <StatCard
          label="Free to message now"
          value={`${summary?.windowOpen ?? 0}`}
          sub="replied within 24h — a message costs nothing"
          tone="good"
        />
        <StatCard
          label="Lists with no basis"
          value={`${summary?.batchesWithoutConsent ?? 0}`}
          sub={`${summary?.optedOut ?? 0} people have opted out`}
          tone={(summary?.batchesWithoutConsent ?? 0) > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search lists"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={refreshLedger}
          disabled={refreshing}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          title="Rebuild what we know about every number from six months of message history"
        >
          {refreshing ? 'Rebuilding…' : 'Rebuild ledger'}
        </button>
        {notice ? <span className="text-sm text-gray-600">{notice}</span> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No lists ingested yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Th>List</Th>
                  <Th>Basis</Th>
                  <Th right>Leads</Th>
                  <Th right>Reachable</Th>
                  <Th right>Not on WA</Th>
                  <Th right>Messaged</Th>
                  <Th right>Replied</Th>
                  <Th right>Converted</Th>
                  <Th right>Spent</Th>
                  <Th right>Per reply</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((batch) => (
                  <tr
                    key={batch.id}
                    onClick={() => setOpenBatch(batch)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <Td>
                      <span className="font-medium">{batch.label}</span>
                      <p className="text-xs text-gray-500">
                        {dateTime(batch.createdAt)}
                        {batch.createdBy ? ` · ${batch.createdBy}` : ''}
                        {batch.holdout > 0 ? ` · ${batch.holdout} held back` : ''}
                      </p>
                    </Td>
                    <Td>
                      <ConsentChip basis={batch.consentBasis} />
                    </Td>
                    <Td right>{batch.leads}</Td>
                    <Td right>
                      {batch.reachable}
                      <span className="ml-1 text-xs text-gray-500">
                        {pct(batch.reachableRate)}
                      </span>
                    </Td>
                    <Td right muted>
                      {batch.notOnWhatsapp}
                      <span className="ml-1 text-xs text-gray-500">
                        {pct(batch.notOnWhatsappRate)}
                      </span>
                    </Td>
                    <Td right muted>
                      {batch.messaged}
                    </Td>
                    <Td right muted>
                      {batch.replied}
                      <span className="ml-1 text-xs text-gray-500">
                        {pct(batch.replyRate)}
                      </span>
                    </Td>
                    <Td right muted>
                      {batch.converted}
                    </Td>
                    <Td right muted>
                      {rupees(batch.spendPaise)}
                    </Td>
                    <Td right muted>
                      {rupees(batch.costPerReplyPaise)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
