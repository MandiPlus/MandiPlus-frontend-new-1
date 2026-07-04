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

  // Team members management state
  const [activeTab, setActiveTab] = useState<'logs' | 'members'>('logs');
  const [members, setMembers] = useState<{ id: string; fullName: string; username: string; mobileNumber: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberMobile, setNewMemberMobile] = useState('');
  const [addingMember, setAddingMember] = useState(false);

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
    if (isAuthenticated && activeTab === 'members') {
      fetchMembers();
    }
  }, [isAuthenticated, activeTab]);

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
          <>
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
                          <p className="text-xs text-slate-500 truncate">{email}</p>
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
                          <div key={log.id} className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">
                                <CategoryBadge category={log.category} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-800 leading-relaxed font-semibold">{log.summary}</p>
                                {log.notes && (
                                  <p className="mt-1 text-xs text-slate-500 italic">{log.notes}</p>
                                )}
                                
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {log.morningWins && (
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Morning Plan (Wins)</span>
                                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{log.morningWins}</p>
                                    </div>
                                  )}
                                  {log.eveningDone && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3">
                                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Evening Accomplishment</span>
                                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{log.eveningDone}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {log.hoursSpent > 0 && (
                                <span className="shrink-0 text-xs text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{log.hoursSpent}h</span>
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
          </>
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
