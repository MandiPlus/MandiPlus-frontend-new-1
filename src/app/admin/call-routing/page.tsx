'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type CallAgent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  productCategories: string[];
  isDefault: boolean;
  isOnline: boolean;
  createdAt: string;
};

type CallLog = {
  id: string;
  callSid: string;
  callerPhone: string;
  agentPhone: string | null;
  agentName: string | null;
  direction: string;
  status: string | null;
  durationSeconds: number | null;
  conversationSeconds: number | null;
  recordingUrl: string | null;
  productCategory: string | null;
  callerName: string | null;
  createdAt: string;
};

function formatPhone(phone?: string | null) {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (s === 'busy') return { label: 'Busy', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (s === 'no-answer') return { label: 'Missed', classes: 'bg-red-50 text-red-700 border-red-200' };
  if (s === 'failed') return { label: 'Failed', classes: 'bg-red-50 text-red-700 border-red-200' };
  if (s === 'in-progress') return { label: 'Ringing', classes: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { label: status || 'Pending', classes: 'bg-gray-50 text-gray-500 border-gray-200' };
}

export default function CallRoutingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [agents, setAgents] = useState<CallAgent[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [outboundPhone, setOutboundPhone] = useState('');
  const [calling, setCalling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/exotel/agents`),
        fetch(`${API_BASE}/exotel/call-logs?limit=50`),
      ]);
      const agentsData = await agentsRes.json();
      const logsData = await logsRes.json();
      setAgents(agentsData.data || []);
      setCallLogs(logsData.data || []);
    } catch (err) {
      console.error('Failed to fetch call data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, router, fetchData]);

  const toggleAgentStatus = async (agent: CallAgent) => {
    try {
      await fetch(`${API_BASE}/exotel/agents/${agent.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: !agent.isOnline }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle agent status:', err);
    }
  };

  const makeOutboundCall = async () => {
    if (!outboundPhone.trim()) return;
    const defaultAgent = agents.find((a) => a.isDefault) || agents[0];
    if (!defaultAgent) return;
    setCalling(true);
    try {
      await fetch(`${API_BASE}/exotel/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPhone: defaultAgent.phone,
          customerPhone: outboundPhone.trim(),
        }),
      });
      setOutboundPhone('');
      setTimeout(fetchData, 3000);
    } catch (err) {
      console.error('Failed to make outbound call:', err);
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Call Routing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage agents, view call logs, and make outbound calls via Exotel (080-472-85284)
          </p>
        </div>

        {/* Agents Section */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`rounded-lg border p-4 ${agent.isOnline ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{agent.name}</span>
                  <button
                    onClick={() => toggleAgentStatus(agent)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      agent.isOnline
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {agent.isOnline ? 'Online' : 'Offline'}
                  </button>
                </div>
                <p className="text-sm text-gray-600">{formatPhone(agent.phone)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.productCategories.map((cat) => (
                    <span key={cat} className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      {cat}
                    </span>
                  ))}
                </div>
                {agent.isDefault && (
                  <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Default (fallback)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Outbound Call */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Make Outbound Call</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Enter customer phone number"
              value={outboundPhone}
              onChange={(e) => setOutboundPhone(e.target.value)}
              className="flex-1 max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              onKeyDown={(e) => e.key === 'Enter' && makeOutboundCall()}
            />
            <button
              onClick={makeOutboundCall}
              disabled={calling || !outboundPhone.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {calling ? 'Calling...' : 'Call'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Caller ID shown: 080-472-85284 • Agent picks up first, then customer is connected
          </p>
        </div>

        {/* Call Logs */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Call Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Caller</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Agent</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
                        <span>Loading call logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No call logs yet. Make a test call to see data here.
                    </td>
                  </tr>
                ) : (
                  callLogs.map((log) => {
                    const badge = getStatusBadge(log.status);
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {timeAgo(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{log.callerName || formatPhone(log.callerPhone)}</div>
                          {log.callerName && <div className="text-xs text-gray-500">{formatPhone(log.callerPhone)}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{log.agentName || '-'}</td>
                        <td className="px-4 py-3">
                          {log.productCategory ? (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
                              {log.productCategory}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                          {formatDuration(log.conversationSeconds || log.durationSeconds)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {log.direction === 'inbound' ? '📞 Inbound' : '📤 Outbound'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
