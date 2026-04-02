'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import {
  FieldAppointment,
  getMyFieldMeetings,
  submitMeetingFeedback,
} from '@/features/field/api';

const outcomeOptions = [
  'meeting_completed',
  'converted',
  'follow_up_required',
  'not_interested',
  'closed',
] as const;

const interestOptions = ['hot', 'warm', 'cold'] as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<FieldAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerResponse: '',
    interestLevel: 'warm',
    notes: '',
    nextAction: '',
    followUpDate: '',
    outcomeStatus: 'meeting_completed',
  });

  const loadMeetings = async () => {
    try {
      setLoading(true);
      setError('');
      setMeetings(await getMyFieldMeetings());
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to load meetings'
          : 'Failed to load meetings',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    appointmentId: string,
  ) => {
    event.preventDefault();
    try {
      setSubmittingId(appointmentId);
      await submitMeetingFeedback(appointmentId, {
        ...form,
        interestLevel: form.interestLevel as 'hot' | 'warm' | 'cold',
        outcomeStatus: form.outcomeStatus as
          | 'meeting_completed'
          | 'converted'
          | 'follow_up_required'
          | 'not_interested'
          | 'closed',
      });
      setActiveId(null);
      setForm({
        customerResponse: '',
        interestLevel: 'warm',
        notes: '',
        nextAction: '',
        followUpDate: '',
        outcomeStatus: 'meeting_completed',
      });
      await loadMeetings();
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to submit feedback'
          : 'Failed to submit feedback',
      );
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Meetings & feedback
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Assigned meeting team members can track appointments here and submit
          visit outcomes without switching devices.
        </p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading meetings...
        </div>
      ) : error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No meetings assigned yet.
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <article
              key={meeting.id}
              className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {meeting.lead.businessName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {meeting.lead.customerName}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    {meeting.lead.businessAddress}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold">
                    {formatDateTime(meeting.scheduledAt)}
                  </p>
                  <p className="mt-1 capitalize">{meeting.status}</p>
                </div>
              </div>

              {meeting.notes ? (
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {meeting.notes}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setActiveId((prev) => (prev === meeting.id ? null : meeting.id))
                  }
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {activeId === meeting.id
                    ? 'Hide feedback form'
                    : 'Submit feedback'}
                </button>
              </div>

              {activeId === meeting.id ? (
                <form
                  onSubmit={(event) => handleSubmit(event, meeting.id)}
                  className="mt-5 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2"
                >
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Customer response
                    </span>
                    <textarea
                      rows={3}
                      value={form.customerResponse}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customerResponse: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Interest level
                    </span>
                    <select
                      value={form.interestLevel}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          interestLevel: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    >
                      {interestOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Outcome status
                    </span>
                    <select
                      value={form.outcomeStatus}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          outcomeStatus: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    >
                      {outcomeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Next action
                    </span>
                    <input
                      value={form.nextAction}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          nextAction: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Follow-up date
                    </span>
                    <input
                      type="datetime-local"
                      value={form.followUpDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          followUpDate: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Notes
                    </span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={submittingId === meeting.id}
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {submittingId === meeting.id
                        ? 'Saving feedback...'
                        : 'Save feedback'}
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
