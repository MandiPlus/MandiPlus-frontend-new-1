'use client';

import { useEffect, useState } from 'react';

interface AccessLog {
  id: string;
  adminIdentifier: string;
  adminAccountId: string | null;
  role: string;
  action: string;
  section: string | null;
  endpoint: string | null;
  method: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface ActiveSession {
  adminIdentifier: string;
  adminAccountId: string | null;
  role: string;
  lastActiveAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  actionCount: string;
}

interface AccessStats {
  totalActions: number;
  uniqueAdmins: number;
  loginCount: number;
  sectionBreakdown: Array<{ section: string; count: string }>;
}

interface AdminAccount {
  id: string;
  fullName: string;
  username: string;
  mobileNumber: string;
  requestedRole: string;
  status: string;
  assignedSections: string[];
  createdAt: string;
  lastActiveAt: string | null;
  lastIpAddress: string | null;
  lastUserAgent: string | null;
  totalActions: number;
}

export default function AccessMonitorPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoursFilter, setHoursFilter] = useState(24);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'sessions' | 'logs' | 'stats'>('accounts');

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [logsRes, sessionsRes, statsRes, accountsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/admin/access-logs?hours=${hoursFilter}&limit=200${actionFilter ? `&action=${actionFilter}` : ''}`, { headers }),
        fetch(`${apiBaseUrl}/admin/access-logs/active-sessions?hours=${hoursFilter}`, { headers }),
        fetch(`${apiBaseUrl}/admin/access-logs/stats?hours=${hoursFilter}`, { headers }),
        fetch(`${apiBaseUrl}/admin/access-logs/accounts`, { headers }),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.data || []);
      }
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.data || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || null);
      }
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch access logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [hoursFilter, actionFilter]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-green-100 text-green-800';
      case 'impersonate': return 'bg-red-100 text-red-800';
      case 'api_call': return 'bg-blue-100 text-blue-800';
      case 'page_view': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return 'bg-red-50 text-red-700 ring-red-600/20';
    return 'bg-purple-50 text-purple-700 ring-purple-600/20';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'PENDING': return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
      case 'SUSPENDED': return 'bg-red-50 text-red-700 ring-red-600/20';
      case 'REJECTED': return 'bg-gray-50 text-gray-700 ring-gray-600/20';
      default: return 'bg-gray-50 text-gray-700 ring-gray-600/20';
    }
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Other';
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Access Monitor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track who is accessing the admin dashboard and their activity
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <select
            value={hoursFilter}
            onChange={(e) => setHoursFilter(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-[#4309ac] focus:border-[#4309ac]"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button
            onClick={fetchData}
            className="inline-flex items-center rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4309ac]/90"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Admin Accounts</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{accounts.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active (in period)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{stats.uniqueAdmins}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Logins (in period)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{stats.loginCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">API Calls (in period)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalActions}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {(['accounts', 'sessions', 'logs', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 ${
                activeTab === tab
                  ? 'border-[#4309ac] text-[#4309ac]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'accounts' ? 'All Admins' : tab === 'sessions' ? 'Live Activity' : tab === 'logs' ? 'Activity Log' : 'Section Stats'}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4309ac] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* All Admin Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="mt-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Active</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last IP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Total Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {acc.fullName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {acc.username}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-600/20">
                            {acc.requestedRole}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(acc.status)}`}>
                            {acc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {acc.lastActiveAt ? (
                            <span title={formatTime(acc.lastActiveAt)}>
                              {timeAgo(acc.lastActiveAt)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                          {acc.lastIpAddress?.replace('::ffff:', '').replace('::1', 'localhost') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {parseUserAgent(acc.lastUserAgent)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {acc.totalActions || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Activity Tab */}
          {activeTab === 'sessions' && (
            <div className="mt-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Admin</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Active</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">IP Address</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                          No active sessions in the selected time range
                        </td>
                      </tr>
                    ) : (
                      sessions.map((session, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {session.adminIdentifier}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getRoleBadge(session.role)}`}>
                              {session.role === 'admin' ? 'Full Admin' : 'Limited'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatTime(session.lastActiveAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                            {session.ipAddress?.replace('::ffff:', '') || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {parseUserAgent(session.userAgent)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {session.actionCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Log Tab */}
          {activeTab === 'logs' && (
            <div className="mt-6">
              <div className="mb-4">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-[#4309ac] focus:border-[#4309ac]"
                >
                  <option value="">All actions</option>
                  <option value="login">Logins</option>
                  <option value="api_call">API Calls</option>
                  <option value="impersonate">Impersonations</option>
                </select>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Admin</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Endpoint</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                          No activity logs found
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                            {formatTime(log.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {log.adminIdentifier}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                              {log.action}
                            </span>
                            {log.metadata?.impersonatedUserName && (
                              <span className="ml-2 text-xs text-slate-500">
                                &rarr; {log.metadata.impersonatedUserName}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono truncate max-w-[200px]">
                            {log.method && <span className="text-xs font-semibold mr-1">{log.method}</span>}
                            {log.endpoint || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                            {log.ipAddress?.replace('::ffff:', '') || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section Stats Tab */}
          {activeTab === 'stats' && stats && (
            <div className="mt-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Section</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Requests</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(stats.sectionBreakdown || []).map((item, i) => {
                      const maxCount = Number(stats.sectionBreakdown?.[0]?.count || 1);
                      const percentage = Math.round((Number(item.count) / maxCount) * 100);
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900 capitalize">
                            {item.section?.replace(/-/g, ' ') || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {item.count}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-[#4309ac]"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-8">{percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!stats.sectionBreakdown || stats.sectionBreakdown.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                          No section data available yet — stats accumulate as admins use the dashboard
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
