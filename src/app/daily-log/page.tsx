'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  LogIn,
  Plus,
  Send,
  Trash2,
  X,
  Phone,
  Users,
  MapPin,
  FileText,
  Headphones,
  Settings,
  MoreHorizontal,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type LogCategory = 'CALLS' | 'MEETINGS' | 'FIELD_VISITS' | 'DOCUMENTATION' | 'CUSTOMER_SUPPORT' | 'OPERATIONS' | 'OTHER';

interface DailyLog {
  id: string;
  submitterEmail: string;
  submitterName: string;
  logDate: string;
  summary: string;
  category: LogCategory;
  notes: string | null;
  hoursSpent: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES: { value: LogCategory; label: string; icon: typeof Phone; color: string; bg: string }[] = [
  { value: 'CALLS', label: 'Calls', icon: Phone, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { value: 'MEETINGS', label: 'Meetings', icon: Users, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { value: 'FIELD_VISITS', label: 'Field Visits', icon: MapPin, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { value: 'DOCUMENTATION', label: 'Documentation', icon: FileText, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer Support', icon: Headphones, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  { value: 'OPERATIONS', label: 'Operations', icon: Settings, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
];

function getCategoryMeta(category: LogCategory) {
  return CATEGORIES.find((c) => c.value === category) || CATEGORIES[6];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function CategoryBadge({ category }: { category: LogCategory }) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export default function PublicDailyLogPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isIdentified, setIsIdentified] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('dailylog_email');
    const savedName = localStorage.getItem('dailylog_name');
    if (savedEmail && savedName) {
      setEmail(savedEmail);
      setName(savedName);
      setIsIdentified(true);
    }
  }, []);

  const handleIdentify = () => {
    if (!email.trim() || !name.trim()) {
      toast.error('Please enter your name and email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email');
      return;
    }
    localStorage.setItem('dailylog_email', email.trim().toLowerCase());
    localStorage.setItem('dailylog_name', name.trim());
    setEmail(email.trim().toLowerCase());
    setName(name.trim());
    setIsIdentified(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dailylog_email');
    localStorage.removeItem('dailylog_name');
    setIsIdentified(false);
    setEmail('');
    setName('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              <span className="text-slate-900">Mandi</span>
              <span className="text-[#4309ac]">Plus</span>
              <span className="text-slate-400 font-normal text-sm ml-2">Daily Log</span>
            </h1>
          </div>
          {isIdentified && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Switch
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!isIdentified ? (
          <IdentifyCard
            email={email}
            name={name}
            setEmail={setEmail}
            setName={setName}
            onSubmit={handleIdentify}
          />
        ) : (
          <LogEntryView email={email} name={name} />
        )}
      </main>
    </div>
  );
}

function IdentifyCard({
  email,
  name,
  setEmail,
  setName,
  onSubmit,
}: {
  email: string;
  name: string;
  setEmail: (v: string) => void;
  setName: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-[#4309ac]/10 flex items-center justify-center mb-3">
            <LogIn className="h-6 w-6 text-[#4309ac]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Enter Your Details</h2>
          <p className="mt-1 text-sm text-slate-500">No signup needed. Just your name and email to get started.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-[#4309ac] focus:outline-none focus:ring-1 focus:ring-[#4309ac]/30"
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Your Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@mandiplus.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-[#4309ac] focus:outline-none focus:ring-1 focus:ring-[#4309ac]/30"
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
          </div>
          <button
            type="button"
            onClick={onSubmit}
            className="w-full rounded-xl bg-[#4309ac] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a0897]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function LogEntryView({ email, name }: { email: string; name: string }) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);

  const [logDate, setLogDate] = useState(todayStr());
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<LogCategory>('OTHER');
  const [notes, setNotes] = useState('');
  const [hoursSpent, setHoursSpent] = useState(0);

  const fetchMyLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/team-daily-logs/public/my-logs`, {
        params: { email },
      });
      if (res.data?.success) {
        setLogs(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load your logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLogs();
  }, [email]);

  const handleSubmit = async () => {
    if (!summary.trim()) {
      toast.error('Please describe what you worked on');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`${API_BASE}/team-daily-logs/public/submit`, {
        submitterEmail: email,
        submitterName: name,
        logDate,
        summary: summary.trim(),
        category,
        notes: notes.trim() || undefined,
        hoursSpent,
      });
      toast.success('Log submitted!');
      setSummary('');
      setNotes('');
      setHoursSpent(0);
      fetchMyLogs();
    } catch {
      toast.error('Failed to submit log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/team-daily-logs/public/${id}`, {
        params: { email },
      });
      toast.success('Log deleted');
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEditSave = async (dto: { summary: string; category: LogCategory; notes: string; hoursSpent: number }) => {
    if (!editingLog) return;
    try {
      await axios.patch(
        `${API_BASE}/team-daily-logs/public/${editingLog.id}`,
        { ...dto, notes: dto.notes || undefined },
        { params: { email } },
      );
      toast.success('Log updated');
      setEditingLog(null);
      fetchMyLogs();
    } catch {
      toast.error('Failed to update');
    }
  };

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, DailyLog[]>();
    for (const log of logs) {
      const key = log.logDate;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  return (
    <>
      {/* Quick Entry */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-4 w-4 text-[#4309ac]" />
          <h2 className="text-sm font-semibold text-slate-900">What did you do today?</h2>
        </div>

        <div className="space-y-3">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. Made 15 calls to pending payment customers, resolved 3 disputes, visited Pune mandi..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-[#4309ac] focus:outline-none focus:ring-1 focus:ring-[#4309ac]/30 resize-none"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LogCategory)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hours</label>
              <input
                type="number"
                min={0}
                max={24}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(Math.min(24, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !summary.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a0897] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </button>
            </div>
          </div>

          <div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes, blockers, follow-ups... (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm placeholder:text-slate-400 focus:border-[#4309ac] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* My Past Logs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Your Recent Logs</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
            ))}
          </div>
        ) : groupedLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No logs yet. Submit your first daily update above.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedLogs.map(([date, dateLogs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{formatDate(date)}</span>
                  <span className="text-xs text-slate-400">({dateLogs.length})</span>
                </div>
                <div className="space-y-2">
                  {dateLogs.map((log) => (
                    <div
                      key={log.id}
                      className="group rounded-xl border border-slate-150 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <CategoryBadge category={log.category} />
                            {log.hoursSpent > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="h-3 w-3" />
                                {log.hoursSpent}h
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">{log.summary}</p>
                          {log.notes && (
                            <p className="mt-1.5 text-xs text-slate-500 italic">{log.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingLog(log)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <EditModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSave={handleEditSave}
        />
      )}
    </>
  );
}

function EditModal({
  log,
  onClose,
  onSave,
}: {
  log: DailyLog;
  onClose: () => void;
  onSave: (dto: { summary: string; category: LogCategory; notes: string; hoursSpent: number }) => void;
}) {
  const [summary, setSummary] = useState(log.summary);
  const [category, setCategory] = useState<LogCategory>(log.category);
  const [notes, setNotes] = useState(log.notes || '');
  const [hoursSpent, setHoursSpent] = useState(log.hoursSpent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!summary.trim()) {
      toast.error('Summary is required');
      return;
    }
    setSaving(true);
    await onSave({ summary: summary.trim(), category, notes: notes.trim(), hoursSpent });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Edit Log</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LogCategory)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hours</label>
              <input
                type="number"
                min={0}
                max={24}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(Math.min(24, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Summary *</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a0897] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
