'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  errorText,
  posMachinesApi,
  type CustomerHit,
  type MachineStatus,
  type PayMode,
  type PosMachine,
  type PosMachineEvent,
  type PosMachinePayment,
  type PosMachineTotals,
} from '@/features/admin/api/posMachines.api';

const IST = 'Asia/Kolkata';
const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const phoneText = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
const dayText = (d: string | null) =>
  d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS: Record<MachineStatus, { label: string; tone: string }> = {
  given: { label: 'Given', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  stock: { label: 'In stock', tone: 'bg-gray-50 text-gray-600 ring-gray-500/20' },
  repair: { label: 'Repair', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  lost: { label: 'Lost', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};
const ACTION: Record<string, string> = {
  added: 'Added', given: 'Given', returned: 'Returned', repair: 'Sent for repair', lost: 'Marked lost',
  paid: 'Payment', unpaid: 'Payment struck out', edited: 'Edited',
};
const MODES: { key: PayMode; label: string }[] = [
  { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'bank', label: 'Bank' }, { key: 'other', label: 'Other' },
];
const FILTERS: { key: MachineStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'given', label: 'Given' }, { key: 'stock', label: 'In stock' }, { key: 'repair', label: 'Repair' }, { key: 'lost', label: 'Lost' },
];

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none focus:ring-1 focus:ring-[#4309ac]';

function Pill({ status }: { status: MachineStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.tone}`}>{s.label}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'due' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === 'due' ? 'text-rose-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${value === o.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Rupees typed, paise out. */
function Money({ value, onChange, autoFocus }: { value: number; onChange: (paise: number) => void; autoFocus?: boolean }) {
  const [txt, setTxt] = useState(value ? String(value / 100) : '');
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">₹</span>
      <input className={`${inputCls} pl-7`} inputMode="decimal" autoFocus={autoFocus} value={txt} placeholder="0"
        onChange={(e) => { const t = e.target.value.replace(/[^\d.]/g, ''); setTxt(t); onChange(Math.round(Number(t || 0) * 100)); }} />
    </div>
  );
}

function Modal({ title, onClose, onSave, saving, error, saveLabel = 'Save', children }: {
  title: string; onClose: () => void; onSave: () => void; saving: boolean; error: string; saveLabel?: string; children: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-0 sm:items-center sm:p-4" onClick={() => !saving && onClose()}>
      <form className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {error && <p className="px-5 pb-2 text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a0896] disabled:opacity-60">{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </form>
    </div>
  );
}

function useSave(run: () => Promise<unknown>, done: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true); setError('');
    try { await run(); done(); } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  return { saving, error, save: () => void save() };
}

export default function PosMachinesPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const allowed = canAccessSection('pos-machines');
  const [machines, setMachines] = useState<PosMachine[] | null>(null);
  const [totals, setTotals] = useState<PosMachineTotals | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [show, setShow] = useState<MachineStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !allowed) router.replace('/admin/dashboard');
  }, [authLoading, isAuthenticated, allowed, router]);

  const load = useCallback(async () => {
    try {
      const r = await posMachinesApi.list();
      setMachines(r.machines); setTotals(r.totals); setError('');
    } catch (e) { setError(errorText(e)); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (isAuthenticated && allowed) void load(); }, [isAuthenticated, allowed, load]);

  const rows = useMemo(() => {
    const f = q.trim().toLowerCase();
    return (machines ?? []).filter((m) => (show === 'all' || m.status === show)
      && (!f || [m.serial, m.model, m.tid, m.name, m.phone].some((x) => x.toLowerCase().includes(f))));
  }, [machines, q, show]);

  if (authLoading || !isAuthenticated || !allowed) return null;
  const open = machines?.find((m) => m.id === openId) ?? null;

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">POS Machines</h1>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a0896]">
            <PlusIcon className="h-4 w-4" /> Add machine
          </button>
        </div>

        {totals && (
          <div className="mb-5 grid grid-cols-3 gap-3 lg:grid-cols-5">
            <Stat label="Machines" value={String(totals.count)} />
            <Stat label="Given" value={String(totals.given)} />
            <Stat label="In stock" value={String(totals.stock)} />
            <div className="col-span-3 grid grid-cols-2 gap-3 lg:col-span-2">
              <Stat label="Received" value={rupees(totals.paidPaise)} />
              <Stat label="Due" value={rupees(totals.duePaise)} tone="due" />
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className={`${inputCls} pl-9`} placeholder="Serial, customer or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:w-[440px] sm:px-0"><Seg value={show} options={FILTERS} onChange={setShow} /></div>
        </div>

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {!machines ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">{machines.length ? 'No machine matches' : 'No machines yet'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Machine</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="hidden px-4 py-3 md:table-cell">Since</th>
                    <th className="hidden px-4 py-3 text-right md:table-cell">Amount</th>
                    <th className="hidden px-4 py-3 text-right md:table-cell">Paid</th>
                    <th className="px-4 py-3 text-right">Due</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((m) => (
                    <tr key={m.id} onClick={() => setOpenId(m.id)} className="cursor-pointer text-sm hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-gray-900">{m.serial}</p>
                        <p className="text-xs text-gray-500">{[m.model, m.tid && `TID ${m.tid}`].filter(Boolean).join(' · ')}</p>
                        <div className="mt-1 sm:hidden"><Pill status={m.status} /></div>
                      </td>
                      <td className="px-4 py-3">
                        {m.name ? <><p className="font-medium text-gray-900">{m.name}</p><p className="text-xs text-gray-500">{phoneText(m.phone)}</p></> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-gray-600 md:table-cell">{m.status === 'given' ? dayText(m.givenOn) : ''}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-gray-700 md:table-cell">{m.status === 'given' ? rupees(m.pricePaise) : ''}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-right text-gray-700 md:table-cell">{m.status === 'given' ? rupees(m.paidPaise) : ''}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${m.duePaise > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{m.status === 'given' ? rupees(m.duePaise) : ''}</td>
                      <td className="hidden px-4 py-3 sm:table-cell"><Pill status={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {open && <MachinePanel key={`${open.id}-${open.updatedAt}`} m={open} onClose={() => setOpenId(null)} onChanged={load} />}
      {adding && <AddSheet onClose={() => setAdding(false)} onDone={async (id) => { setAdding(false); await load(); setOpenId(id); }} />}
    </div>
  );
}

/** One machine: who has it, the money, and everything that happened to it. */
function MachinePanel({ m, onClose, onChanged }: { m: PosMachine; onClose: () => void; onChanged: () => Promise<void> }) {
  const [events, setEvents] = useState<PosMachineEvent[] | null>(null);
  const [payments, setPayments] = useState<PosMachinePayment[]>([]);
  const [sheet, setSheet] = useState<'give' | 'back' | 'pay' | 'edit' | null>(null);
  const [tab, setTab] = useState<'payments' | 'history'>('payments');

  const load = useCallback(async () => {
    const d = await posMachinesApi.detail(m.id);
    setEvents(d.events); setPayments(d.payments);
  }, [m.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sheet) onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose, sheet]);

  const changed = async () => { setSheet(null); await onChanged(); await load(); };
  const strike = async (p: PosMachinePayment) => {
    if (!confirm(`Strike out ${rupees(p.amountPaise)} from ${dayText(p.paidOn)}?`)) return;
    await posMachinesApi.voidPayment(m.id, p.id);
    await onChanged();
    await load();
  };
  const given = m.status === 'given';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-semibold text-gray-900">{m.serial}</h2>
              <Pill status={m.status} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{[m.model, m.tid && `TID ${m.tid}`].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {given ? (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-base font-semibold text-gray-900">{m.name}</p>
              <p className="text-sm text-gray-500">{[phoneText(m.phone), `since ${dayText(m.givenOn)}`].filter(Boolean).join(' · ')}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-sm">
                <div><p className="text-xs text-gray-500">Amount</p><p className="mt-0.5 font-semibold text-gray-900">{rupees(m.pricePaise)}</p></div>
                <div><p className="text-xs text-gray-500">Paid</p><p className="mt-0.5 font-semibold text-emerald-700">{rupees(m.paidPaise)}</p></div>
                <div><p className="text-xs text-gray-500">Due</p><p className={`mt-0.5 font-semibold ${m.duePaise > 0 ? 'text-rose-600' : 'text-gray-900'}`}>{rupees(m.duePaise)}</p></div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">Not with anyone</div>
          )}
          {m.note && <p className="text-sm text-gray-600">{m.note}</p>}

          <div className="flex flex-wrap gap-2">
            {given && <button onClick={() => setSheet('pay')} className="rounded-lg bg-[#4309ac] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3a0896]">Add payment</button>}
            <button onClick={() => setSheet('give')} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${given ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-[#4309ac] text-white hover:bg-[#3a0896]'}`}>{given ? 'Give to someone else' : 'Give machine'}</button>
            {given && <button onClick={() => setSheet('back')} className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Take back</button>}
            <button onClick={() => setSheet('edit')} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100">Edit</button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-3 w-56"><Seg value={tab} onChange={setTab} options={[{ key: 'payments', label: 'Payments' }, { key: 'history', label: 'History' }]} /></div>
            {!events ? <div className="h-16 animate-pulse rounded bg-gray-100" /> : tab === 'payments' ? (
              payments.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No payments</p> : (
                <ul className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <li key={p.id} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${p.voidedAt ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <p className={`font-semibold text-gray-900 ${p.voidedAt ? 'line-through' : ''}`}>{rupees(p.amountPaise)} <span className="ml-1 text-xs font-medium uppercase text-gray-500">{p.mode}</span></p>
                        <p className="truncate text-xs text-gray-500">{[dayText(p.paidOn), !p.current && p.name, p.note].filter(Boolean).join(' · ')}</p>
                      </div>
                      {!p.voidedAt && p.current && <button onClick={() => void strike(p)} className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-rose-600" aria-label="Strike out"><XMarkIcon className="h-4 w-4" /></button>}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ol className="relative space-y-4 border-l border-gray-200 pl-4">
                {events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-gray-300" />
                    <p className="font-medium text-gray-900">{ACTION[e.action] ?? e.action}{e.name ? ` · ${e.name}` : ''}{e.amountPaise ? ` · ${rupees(e.amountPaise)}` : ''}</p>
                    <p className="text-xs text-gray-500">{[dayText(e.onDay), e.phone && phoneText(e.phone), e.note, e.by].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </aside>

      <div onClick={(e) => e.stopPropagation()}>
        {sheet === 'give' && <GiveSheet m={m} onClose={() => setSheet(null)} onDone={changed} />}
        {sheet === 'back' && <BackSheet m={m} onClose={() => setSheet(null)} onDone={changed} />}
        {sheet === 'pay' && <PaySheet m={m} onClose={() => setSheet(null)} onDone={changed} />}
        {sheet === 'edit' && <EditSheet m={m} onClose={() => setSheet(null)} onDone={changed} />}
      </div>
    </div>
  );
}

function AddSheet({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [serial, setSerial] = useState('');
  const [model, setModel] = useState('Pine P5');
  const [tid, setTid] = useState('');
  const s = useSave(async () => { const r = await posMachinesApi.add({ serial, model, tid }); onDone(r.id); }, () => {});
  return (
    <Modal title="Add machine" onClose={onClose} onSave={s.save} saving={s.saving} error={s.error} saveLabel="Add">
      <Field label="Serial number"><input className={`${inputCls} font-mono uppercase`} autoFocus value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Model"><input className={inputCls} list="pos-models" value={model} onChange={(e) => setModel(e.target.value)} /></Field>
        <Field label="TID"><input className={inputCls} value={tid} onChange={(e) => setTid(e.target.value)} /></Field>
      </div>
      <datalist id="pos-models"><option value="Pine P5" /><option value="Pine A910" /></datalist>
    </Modal>
  );
}

function EditSheet({ m, onClose, onDone }: { m: PosMachine; onClose: () => void; onDone: () => void }) {
  const [serial, setSerial] = useState(m.serial);
  const [model, setModel] = useState(m.model);
  const [tid, setTid] = useState(m.tid);
  const [note, setNote] = useState(m.note);
  const [price, setPrice] = useState(m.pricePaise);
  const s = useSave(() => posMachinesApi.edit(m.id, { serial, model, tid, note, ...(m.status === 'given' ? { pricePaise: price } : {}) }), onDone);
  return (
    <Modal title="Edit machine" onClose={onClose} onSave={s.save} saving={s.saving} error={s.error}>
      <Field label="Serial number"><input className={`${inputCls} font-mono uppercase`} value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Model"><input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} /></Field>
        <Field label="TID"><input className={inputCls} value={tid} onChange={(e) => setTid(e.target.value)} /></Field>
      </div>
      {m.status === 'given' && <Field label="Amount"><Money value={price} onChange={setPrice} /></Field>}
      <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

/** A MandiPlus customer, searched by name or mobile; or anyone, by name and mobile. */
function CustomerPicker({ value, onPick }: { value: CustomerHit | null; onPick: (c: CustomerHit | null, typed: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const searching = !value && q.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => { posMachinesApi.customers(q).then(setHits).catch(() => setHits([])); }, 250);
    return () => clearTimeout(t);
  }, [q, searching]);
  const shown = searching ? hits : [];
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[#4309ac]/30 bg-[#4309ac]/5 px-3 py-2">
        <div><p className="text-sm font-semibold text-gray-900">{value.name}</p><p className="text-xs text-gray-500">{phoneText(value.phone)}</p></div>
        <button type="button" onClick={() => { onPick(null, ''); setQ(''); }} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Change"><XMarkIcon className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div>
      <input className={inputCls} autoFocus placeholder="Name or mobile" value={q} onChange={(e) => { setQ(e.target.value); onPick(null, e.target.value); }} />
      {shown.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
          {shown.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => onPick(h, '')} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
                <span className="font-medium text-gray-900">{h.name}</span><span className="text-xs text-gray-500">{phoneText(h.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GiveSheet({ m, onClose, onDone }: { m: PosMachine; onClose: () => void; onDone: () => void }) {
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [givenOn, setGivenOn] = useState(todayIst());
  const [price, setPrice] = useState(0);
  const [note, setNote] = useState('');
  const s = useSave(() => posMachinesApi.give(m.id, {
    userId: customer?.id ?? null, name: customer ? customer.name : name, phone: customer ? customer.phone : mobile, givenOn, pricePaise: price, note,
  }), onDone);
  return (
    <Modal title={`Give ${m.serial}`} onClose={onClose} onSave={s.save} saving={s.saving} error={s.error} saveLabel="Give">
      <Field label="Customer"><CustomerPicker value={customer} onPick={(c, typed) => { setCustomer(c); if (!c) setName(typed); }} /></Field>
      {!customer && (
        <Field label="Mobile"><input className={inputCls} inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input className={inputCls} type="date" value={givenOn} onChange={(e) => setGivenOn(e.target.value)} /></Field>
        <Field label="Amount"><Money value={price} onChange={setPrice} /></Field>
      </div>
      <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

function PaySheet({ m, onClose, onDone }: { m: PosMachine; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(m.duePaise);
  const [mode, setMode] = useState<PayMode>('cash');
  const [paidOn, setPaidOn] = useState(todayIst());
  const [note, setNote] = useState('');
  const s = useSave(() => posMachinesApi.pay(m.id, { amountPaise: amount, mode, paidOn, note }), onDone);
  return (
    <Modal title={`Payment · ${m.name}`} onClose={onClose} onSave={s.save} saving={s.saving} error={s.error}>
      <Field label="Amount"><Money value={amount} onChange={setAmount} autoFocus /></Field>
      <Seg value={mode} options={MODES} onChange={setMode} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input className={inputCls} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
        <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function BackSheet({ m, onClose, onDone }: { m: PosMachine; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<'stock' | 'repair' | 'lost'>('stock');
  const [onDay, setOnDay] = useState(todayIst());
  const [note, setNote] = useState('');
  const s = useSave(() => posMachinesApi.back(m.id, { status, onDay, note }), onDone);
  return (
    <Modal title={`Take back from ${m.name}`} onClose={onClose} onSave={s.save} saving={s.saving} error={s.error}>
      <Seg value={status} onChange={setStatus} options={[{ key: 'stock', label: 'To stock' }, { key: 'repair', label: 'Repair' }, { key: 'lost', label: 'Lost' }]} />
      {m.duePaise > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{rupees(m.duePaise)} still due</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input className={inputCls} type="date" value={onDay} onChange={(e) => setOnDay(e.target.value)} /></Field>
        <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
