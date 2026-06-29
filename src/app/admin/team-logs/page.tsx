'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  ExternalLink,
  Users,
  UserX,
  Phone,
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

interface MemberStat {
  submitterEmail: string;
  submitterName: string;
  logCount: number;
  totalHours: number;
}

interface Overview {
  date: string;
  totalLogs: number;
  memberStats: MemberStat[];
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

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />;
}

export default function TeamDailyLogsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterMember, setFilterMember] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, router]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterDate) {
        params.startDate = filterDate;
        params.endDate = filterDate;
      }
      if (filterMember) params.submitterEmail = filterMember;
      if (filterCategory) params.category = filterCategory;

      const [logsRes, overviewRes] = await Promise.all([
        axios.get(`${API_BASE}/team-daily-logs/all`, { headers: getHeaders(), params }),
        axios.get(`${API_BASE}/team-daily-logs/overview`, { headers: getHeaders(), params: { date: filterDate || todayStr() } }),
      ]);

      if (logsRes.data?.success) setLogs(logsRes.data.data || []);
      if (overviewRes.data?.success) setOverview(overviewRes.data.data || null);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchTeamData();
  }, [isAuthenticated, filterDate, filterMember, filterCategory]);

  const uniqueMembers = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of logs) {
      map.set(log.submitterEmail, log.submitterName);
    }
    if (overview) {
      for (const stat of overview.memberStats) {
        map.set(stat.submitterEmail, stat.submitterName);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs, overview]);

  const groupedByPerson = useMemo(() => {
    const groups = new Map<string, { email: string; name: string; logs: DailyLog[] }>();
    for (const log of logs) {
      if (!groups.has(log.submitterEmail)) {
        groups.set(log.submitterEmail, { email: log.submitterEmail, name: log.submitterName, logs: [] });
      }
      groups.get(log.submitterEmail)!.logs.push(log);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const totalHours = overview?.memberStats.reduce((sum, m) => sum + m.totalHours, 0) || 0;
  const avgHours = overview?.memberStats.length ? Math.round(totalHours / overview.memberStats.length) : 0;

  if (!isAuthenticated) return null;

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/daily-log` : '/daily-log';

  return (
    <div className="min-h-screen py-6">
      <div className="mx-auto w-full max-w-[1400px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Daily Logs</h1>
            <p className="mt-1 text-sm text-slate-500">Monitor what the team is doing every day</p>
          </div>
          <a
            href="/daily-log"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#4309ac]/20 bg-[#4309ac]/5 px-4 py-2 text-sm font-medium text-[#4309ac] transition hover:bg-[#4309ac]/10"
          >
            <ExternalLink className="h-4 w-4" />
            Team Submission Link
          </a>
        </div>

        {/* Share URL */}
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-medium text-blue-800 mb-1">Share this link with your team to submit daily logs (no login required):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-blue-200 px-3 py-1.5 text-sm text-blue-900 font-mono truncate">{publicUrl}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copied!'); }}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Filters</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
            />
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
            >
              <option value="">All Members</option>
              {uniqueMembers.map(([email, name]) => (
                <option key={email} value={email}>{name}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Overview Cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Logs</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{overview?.totalLogs || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Members Logged</span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{overview?.memberStats.length || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Hours</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{avgHours}h</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Hours</span>
                <Activity className="h-4 w-4 text-[#4309ac]" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalHours}h</div>
            </div>
          </div>
        )}

        {/* Team Feed */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : groupedByPerson.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <UserX className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No logs found for this date.</p>
            <p className="mt-1 text-xs text-slate-400">Share the submission link with your team to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByPerson.map(({ email, name, logs: personLogs }) => {
              const totalPersonHours = personLogs.reduce((sum, l) => sum + l.hoursSpent, 0);
              return (
                <div
                  key={email}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* Person Header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 bg-slate-50/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4309ac]/10 text-xs font-bold text-[#4309ac]">
                      {getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      <p className="text-xs text-slate-500">{email}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {personLogs.length} {personLogs.length === 1 ? 'log' : 'logs'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        {totalPersonHours}h
                      </span>
                    </div>
                  </div>

                  {/* Logs */}
                  <div className="divide-y divide-slate-50">
                    {personLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <CategoryBadge category={log.category} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 leading-relaxed">{log.summary}</p>
                            {log.notes && (
                              <p className="mt-1 text-xs text-slate-500 italic">{log.notes}</p>
                            )}
                          </div>
                          {log.hoursSpent > 0 && (
                            <span className="shrink-0 text-xs text-slate-400 font-medium">{log.hoursSpent}h</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
