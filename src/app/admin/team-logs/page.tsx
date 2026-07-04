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
  UserPlus,
  Trash2,
  Plus,
  X,
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
  morningWins: string | null;
  eveningDone: string | null;
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
  { value: 'OTHER', label: 'General Tasks', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
];

function getCategoryMeta(category: LogCategory) {
  return CATEGORIES.find((c) => c.value === category) || CATEGORIES[6];
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

interface AiSummaryData {
  executiveSummary: string;
  totalHours: number;
  categoryBreakdown: Record<string, number>;
  keyMilestones: string[];
  blockersOrRisks: string[];
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

  // Team members management state
  const [activeTab, setActiveTab] = useState<'logs' | 'members'>('logs');
  const [members, setMembers] = useState<{ id: string; fullName: string; username: string; mobileNumber: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberMobile, setNewMemberMobile] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // AI summary state
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, router]);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await axios.get(`${API_BASE}/team-daily-logs/members`, { headers: getHeaders() });
      if (res.data?.success) {
        setMembers(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load team members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail || !newMemberMobile) {
      toast.error('All fields are required');
      return;
    }
    try {
      setAddingMember(true);
      const res = await axios.post(
        `${API_BASE}/team-daily-logs/members`,
        {
          fullName: newMemberName,
          email: newMemberEmail,
          mobileNumber: newMemberMobile,
        },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        toast.success('Team member added successfully');
        setShowAddModal(false);
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberMobile('');
        fetchMembers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add team member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/team-daily-logs/members/${id}`, { headers: getHeaders() });
      if (res.data?.success) {
        toast.success('Team member removed');
        fetchMembers();
      } else {
        toast.error(res.data?.message || 'Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove team member');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMembers();
    }
  }, [isAuthenticated]);

  const fetchTeamData = async () => {
    setLoading(true);
    setLoadingAiSummary(true);
    setAiSummary(null); // Clear previous AI summary to prevent displaying stale data

    const params: Record<string, string> = {};
    if (filterDate) {
      params.startDate = filterDate;
      params.endDate = filterDate;
    }
    if (filterMember) params.submitterEmail = filterMember;
    if (filterCategory) params.category = filterCategory;

    // Fetch database logs and overview in parallel, and resolve immediately
    const fetchDbLogs = async () => {
      try {
        const [logsRes, overviewRes] = await Promise.all([
          axios.get(`${API_BASE}/team-daily-logs/all`, { headers: getHeaders(), params }),
          axios.get(`${API_BASE}/team-daily-logs/overview`, { headers: getHeaders(), params: { date: filterDate || todayStr() } }),
        ]);

        if (logsRes.data?.success) setLogs(logsRes.data.data || []);
        if (overviewRes.data?.success) setOverview(overviewRes.data.data || null);
      } catch (err) {
        console.error('Failed to load team daily logs/overview:', err);
        toast.error('Failed to load team logs data');
      } finally {
        setLoading(false);
      }
    };

    // Fetch the slower AI daily summary in the background
    const fetchAiSummary = async () => {
      try {
        const aiRes = await axios.get(`${API_BASE}/team-daily-logs/ai-summary`, {
          headers: getHeaders(),
          params: { date: filterDate || todayStr() },
        });
        if (aiRes.data?.success) {
          setAiSummary(aiRes.data.data);
        } else {
          setAiSummary(null);
        }
      } catch (aiErr) {
        console.error('Failed to fetch AI daily summary:', aiErr);
        setAiSummary(null);
      } finally {
        setLoadingAiSummary(false);
      }
    };

    // Trigger both asynchronous requests concurrently
    fetchDbLogs();
    fetchAiSummary();
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

  const memberStatusMap = useMemo(() => {
    const map = new Map<string, { morning: boolean; evening: boolean; hours: number }>();
    for (const log of logs) {
      const email = log.submitterEmail.toLowerCase().trim();
      const current = map.get(email) || { morning: false, evening: false, hours: 0 };
      if (log.morningWins) current.morning = true;
      if (log.eveningDone || log.summary) current.evening = true;
      current.hours += log.hoursSpent;
      map.set(email, current);
    }
    return map;
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

        {/* Tabs Switcher */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2 px-4 text-sm font-semibold transition ${
              activeTab === 'logs'
                ? 'border-b-2 border-[#4309ac] text-[#4309ac]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Daily Logs Feed
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-2 px-4 text-sm font-semibold transition ${
              activeTab === 'members'
                ? 'border-b-2 border-[#4309ac] text-[#4309ac]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Team Members
          </button>
        </div>

        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Logs Feed & AI Digest (3 Cols) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Share URL */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
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
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

              {/* AI daily summary panel */}
              {loadingAiSummary ? (
                <div className="animate-pulse rounded-3xl border border-violet-100 bg-violet-50/20 p-6">
                  <div className="h-5 w-40 bg-violet-200 rounded mb-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                    <div className="h-4 bg-slate-100 rounded w-5/6" />
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/40 via-white to-indigo-50/20 p-6 shadow-sm relative overflow-hidden backdrop-blur-sm">
                  <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-violet-300/10 to-indigo-400/0 rounded-full blur-3xl pointer-events-none" />
                  
                  {/* Top Bar with standup pipeline status tracker */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4309ac] text-white shadow-sm shadow-[#4309ac]/20">
                        <span className="text-xs font-semibold">✨</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          AI Standup Digest
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-700/10">
                            Gemini 2.5
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Automated standup tracker & executive summary</p>
                      </div>
                    </div>

                    {/* Standup Pipeline Timeline */}
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5 self-start md:self-auto shadow-sm">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        10:00 AM Standup
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1 text-emerald-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        06:30 PM Checkout
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1 text-[#4309ac] animate-pulse">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4309ac]" />
                        09:00 PM EOD synthesis
                      </span>
                    </div>
                  </div>

                  {aiSummary && (aiSummary.keyMilestones.length > 0 || aiSummary.executiveSummary.length > 40) ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Executive Summary */}
                      <div className="lg:col-span-2 space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Executive Summary</h4>
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.2 text-[9px] font-medium text-violet-600 ring-1 ring-inset ring-violet-600/10">
                              Live Draft
                            </span>
                          </div>
                          <p className="text-sm text-slate-705 font-medium leading-relaxed text-slate-700">{aiSummary.executiveSummary}</p>
                        </div>

                        {/* Milestones list */}
                        {aiSummary.keyMilestones && aiSummary.keyMilestones.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-bold text-slate-500">Key Achievements</h4>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                              {aiSummary.keyMilestones.map((m, idx) => (
                                <li key={idx} className="flex items-start gap-2 bg-white/60 p-2.5 rounded-xl border border-slate-100 shadow-sm hover:border-violet-200 transition">
                                  <span className="text-violet-600 shrink-0">🏆</span>
                                  <span className="leading-snug">{m}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Blockers and Category Hour Distribution */}
                      <div className="space-y-4 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100/80">
                        {/* Category Breakdown visual */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hours Distribution</h4>
                          <div className="space-y-2">
                            {Object.entries(aiSummary.categoryBreakdown || {}).map(([cat, hours]) => {
                              const meta = getCategoryMeta(cat as LogCategory);
                              const percentage = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
                              return (
                                <div key={cat} className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-semibold">
                                    <span className="text-slate-600">{meta.label}</span>
                                    <span className="text-slate-400 font-bold">{hours}h ({percentage}%)</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full bg-[#4309ac]" 
                                      style={{ width: `${percentage}%` }} 
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Risks / Blockers */}
                        {aiSummary.blockersOrRisks && aiSummary.blockersOrRisks.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1.5 font-bold">Attention Required</h4>
                            <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                              {aiSummary.blockersOrRisks.map((b, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 bg-red-50/40 p-2 rounded-lg border border-red-100/50">
                                  <span className="text-red-500 shrink-0">⚠️</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <span className="text-2xl mb-1.5 block">📡</span>
                      <p className="text-xs text-slate-500 font-bold">Awaiting team standup submissions</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Live draft report compiles automatically as team members check in.</p>
                    </div>
                  )}
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
                    const status = memberStatusMap.get(email.toLowerCase().trim()) || { morning: false, evening: false, hours: 0 };
                    
                    return (
                      <div
                        key={email}
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                      >
                        {/* Person Header */}
                        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 bg-slate-50/50">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4309ac]/10 text-xs font-bold text-[#4309ac] relative">
                            {getInitials(name)}
                            {status.morning && status.evening ? (
                              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                            ) : status.morning ? (
                              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                              {status.morning && status.evening ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                  Completed
                                </span>
                              ) : status.morning ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/10 animate-pulse">
                                  Checked In
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{email}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-bold text-slate-600">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              {personLogs.length} {personLogs.length === 1 ? 'log' : 'logs'}
                            </span>
                            <span className="flex items-center gap-1 font-bold text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              {totalPersonHours}h
                            </span>
                          </div>
                        </div>

                        {/* Logs */}
                        <div className="divide-y divide-slate-50">
                          {personLogs.map((log) => {
                            // Check if summary is distinct to avoid redundant AI slop text representation
                            const cleanEvening = (log.eveningDone || '').trim();
                            const cleanMorning = (log.morningWins || '').trim();
                            const cleanSummary = (log.summary || '').trim();
                            const hasUniqueSummary = cleanSummary && 
                              cleanSummary !== cleanEvening && 
                              cleanSummary !== cleanMorning &&
                              !cleanEvening.includes(cleanSummary);

                            return (
                              <div key={log.id} className="px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 shrink-0">
                                    <CategoryBadge category={log.category} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {hasUniqueSummary && (
                                      <p className="text-xs font-bold text-violet-800 bg-violet-50/50 border border-violet-100 rounded-lg px-3 py-1.5 mb-3 leading-relaxed inline-block">
                                        📌 {log.summary}
                                      </p>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Morning plan card */}
                                      <div className={`rounded-2xl border p-4 transition ${
                                        log.morningWins 
                                          ? 'border-emerald-100 bg-emerald-50/20' 
                                          : 'border-dashed border-slate-200 bg-slate-50/50'
                                      }`}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <span className="text-emerald-600 text-xs">🎯</span>
                                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Morning Plan</span>
                                        </div>
                                        <p className={`text-xs leading-relaxed font-medium ${log.morningWins ? 'text-slate-700' : 'text-slate-455 text-slate-400 italic'}`}>
                                          {log.morningWins || 'No morning plan was logged.'}
                                        </p>
                                      </div>

                                      {/* Evening done card */}
                                      <div className={`rounded-2xl border p-4 transition ${
                                        log.eveningDone 
                                          ? 'border-blue-100 bg-blue-50/20' 
                                          : 'border-dashed border-blue-200 bg-blue-50/10 animate-pulse'
                                      }`}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <span className="text-blue-600 text-xs">🌅</span>
                                          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Evening Accomplishments</span>
                                        </div>
                                        <p className={`text-xs leading-relaxed font-medium ${log.eveningDone ? 'text-slate-700' : 'text-blue-600/80 font-bold italic'}`}>
                                          {log.eveningDone || 'Awaiting checkout report... ⏳'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Morale Booster speech bubble */}
                                    {log.notes && (
                                      <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-gradient-to-r from-violet-50/40 via-violet-50/20 to-transparent border border-violet-100/60 p-3 text-xs text-violet-700 shadow-sm">
                                        <span className="text-sm shrink-0">💬</span>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-bold text-violet-900">Bot Interaction Feedback</span>
                                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                                          </div>
                                          <p className="italic font-semibold text-violet-850">"{log.notes}"</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {log.hoursSpent > 0 && (
                                    <span className="shrink-0 text-xs text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{log.hoursSpent}h</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Check-In Radar Sidebar (1 Col) */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">📡</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Check-in Radar</h3>
                  </div>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-8 bg-slate-50 animate-pulse rounded-lg" />
                    <div className="h-8 bg-slate-50 animate-pulse rounded-lg" />
                    <div className="h-8 bg-slate-50 animate-pulse rounded-lg" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">No team members registered.</p>
                ) : (
                  <div className="space-y-3.5">
                    {members.map((member) => {
                      const status = memberStatusMap.get(member.username.toLowerCase().trim()) || { morning: false, evening: false, hours: 0 };
                      let dotColor = 'bg-slate-300';
                      let ringColor = 'ring-slate-300/10';
                      let statusText = 'Pending';
                      let badgeBg = 'bg-slate-50 text-slate-400';

                      if (status.morning && status.evening) {
                        dotColor = 'bg-emerald-500';
                        ringColor = 'ring-emerald-500/20';
                        statusText = 'Completed';
                        badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      } else if (status.morning && !status.evening) {
                        dotColor = 'bg-amber-500 animate-pulse';
                        ringColor = 'ring-amber-500/30';
                        statusText = 'Plan Logged';
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-100';
                      } else if (!status.morning && status.evening) {
                        dotColor = 'bg-blue-500';
                        ringColor = 'ring-blue-500/20';
                        statusText = 'Done Logged';
                        badgeBg = 'bg-blue-50 text-blue-700 border-blue-100';
                      }

                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/20 hover:bg-slate-50/60 transition group">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex h-3 w-3 shrink-0">
                              {status.morning && !status.evening && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              )}
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`}></span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-[#4309ac] transition">{member.fullName}</p>
                              <span className="text-[9px] font-semibold text-slate-400 block truncate">{member.username}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badgeBg}`}>
                              {statusText}
                            </span>
                            {status.hours > 0 && (
                              <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-100 px-1 py-0.5 rounded-md">{status.hours}h</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Manage Team Members</h2>
                <p className="text-xs text-slate-500">Add or remove team members who will receive WhatsApp bot daily logs notifications</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#340787]"
              >
                <Plus className="h-4 w-4" />
                Add Member
              </button>
            </div>

            {loadingMembers ? (
              <div className="space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">No team members added yet.</p>
                <p className="mt-1 text-xs text-slate-400">Click the button above to add members to start logs automation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#4309ac]/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4309ac]/10 text-sm font-bold text-[#4309ac]">
                          {getInitials(member.fullName)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 leading-snug">{member.fullName}</h3>
                          <p className="text-xs text-slate-500">{member.username}</p>
                          <p className="text-xs text-slate-500 mt-1 font-mono">+{member.mobileNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Member Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add Team Member</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="e.g. john@mandiplus.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Mobile Number (with country code, no +)</label>
                  <input
                    type="text"
                    required
                    value={newMemberMobile}
                    onChange={(e) => setNewMemberMobile(e.target.value)}
                    placeholder="e.g. 919022353647"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#4309ac] focus:outline-none font-mono"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="rounded-xl bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#340787] disabled:opacity-50"
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
