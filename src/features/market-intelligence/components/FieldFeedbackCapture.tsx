import { FormEvent, useEffect, useState } from 'react';
import { captureFieldFeedback, getMarketWriteStatus } from '../api';
import { MarketWriteStatus } from '../types';

const ACTOR_ROLES = ['buyer', 'supplier', 'transporter', 'agent', 'partner', 'operator', 'other'];
const FEEDBACK_TYPES = ['demand', 'supply', 'competitor', 'route', 'price', 'quality', 'payment', 'general'];

export function FieldFeedbackCapture({
  defaultCommodity,
  defaultState,
  onCaptured,
}: {
  defaultCommodity?: string;
  defaultState?: string;
  onCaptured?: () => void;
}) {
  const [commodity, setCommodity] = useState(defaultCommodity || '');
  const [state, setState] = useState(defaultState || '');
  const [market, setMarket] = useState('');
  const [actorName, setActorName] = useState('');
  const [actorRole, setActorRole] = useState('operator');
  const [feedbackType, setFeedbackType] = useState('general');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [writeStatus, setWriteStatus] = useState<MarketWriteStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMarketWriteStatus()
      .then((response) => {
        if (response.success) setWriteStatus(response.data || null);
      })
      .catch(() => {
        setWriteStatus(null);
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length < 10) {
      setError('Add at least 10 characters of field feedback.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      setMessage('');
      const response = await captureFieldFeedback({
        commodity: commodity.trim() || undefined,
        state: state.trim() || undefined,
        market: market.trim() || undefined,
        actorName: actorName.trim() || undefined,
        actorRole,
        feedbackType,
        text: text.trim(),
        confidence: 0.82,
      });
      if (!response.success) {
        throw new Error(response.message || 'Unable to capture field feedback');
      }
      setText('');
      setMarket('');
      setActorName('');
      setMessage('Feedback captured. Pulse cache cleared; refresh will include this signal.');
      onCaptured?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to capture field feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Capture Ground Signal</h2>
        <p className="text-sm text-slate-500">
          Record buyer, supplier, transporter, agent, or operator feedback after a call.
        </p>
        {writeStatus && !writeStatus.enabled && (
          <div className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {writeStatus.message} Enable <span className="font-mono font-semibold">{writeStatus.requiredEnv}</span> only on a safe database.
          </div>
        )}
      </div>

      <form onSubmit={submit} className="grid gap-3 p-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <input
            value={commodity}
            onChange={(event) => setCommodity(event.target.value)}
            placeholder="Commodity"
            className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <input
            value={state}
            onChange={(event) => setState(event.target.value)}
            placeholder="State"
            className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <input
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            placeholder="Mandi / market"
            className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <input
            value={actorName}
            onChange={(event) => setActorName(event.target.value)}
            placeholder="Actor name"
            className="border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <select
            value={actorRole}
            onChange={(event) => setActorRole(event.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
          >
            {ACTOR_ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select
            value={feedbackType}
            onChange={(event) => setFeedbackType(event.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
          >
            {FEEDBACK_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Example: Buyer in Azadpur says Tomato premium is due to rain-delayed arrivals; can take 2 gadi if rate stays below..."
            className="min-h-36 border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-600"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              {error && <span className="text-red-700">{error}</span>}
              {message && <span className="text-emerald-700">{message}</span>}
              {!error && !message && (
                <span className="text-slate-500">Saved as market observation evidence.</span>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || text.trim().length < 10 || writeStatus?.enabled === false}
              className="bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Capturing...' : 'Capture signal'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
