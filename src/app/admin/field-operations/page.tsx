'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminFieldAppointment,
  AdminFieldLead,
  AdminFieldOverview,
  AdminFieldTeamMember,
  AdminFieldUser,
  createFieldAppointment,
  getFieldAdminAppointments,
  getFieldAdminLeads,
  getFieldAdminOverview,
  getFieldAdminTeamMembers,
  getUsersForFieldOperations,
  upsertFieldAdminTeamMember,
  updateFieldLeadStatus,
} from '@/features/field/admin-api';

const leadStatuses = [
  'new_lead',
  'contact_pending',
  'contacted',
  'appointment_scheduled',
  'meeting_assigned',
  'meeting_completed',
  'converted',
  'not_interested',
  'follow_up_required',
  'closed',
];

const tabs = [
  { key: 'leads', label: 'Leads' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'schedule', label: 'Schedule appointment' },
  { key: 'agents', label: 'Active field agent' },
] as const;

const statMeta = [
  {
    label: 'Total leads',
    badge: 'Lead pipeline',
    accent: 'from-[#fff7ed] via-white to-white',
    valueClass: 'text-[#c2410c]',
  },
  {
    label: 'Pending contacts',
    badge: 'Action needed',
    accent: 'from-[#fef3c7] via-white to-white',
    valueClass: 'text-[#a16207]',
  },
  {
    label: 'Scheduled appointments',
    badge: 'Calendar flow',
    accent: 'from-[#eff6ff] via-white to-white',
    valueClass: 'text-[#1d4ed8]',
  },
  {
    label: 'Completed meetings',
    badge: 'Done',
    accent: 'from-[#ecfdf5] via-white to-white',
    valueClass: 'text-[#047857]',
  },
  {
    label: "Today's meetings",
    badge: 'Today',
    accent: 'from-[#eef2ff] via-white to-white',
    valueClass: 'text-[#5b21b6]',
  },
  {
    label: "Today's leads",
    badge: 'Fresh entries',
    accent: 'from-[#fff1f2] via-white to-white',
    valueClass: 'text-[#be123c]',
  },
] as const;

type TabKey = (typeof tabs)[number]['key'];

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function sectionShell(children: React.ReactNode) {
  return (
    <div className="rounded-[1.7rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      {children}
    </div>
  );
}

export default function AdminFieldOperationsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<AdminFieldOverview | null>(null);
  const [leads, setLeads] = useState<AdminFieldLead[]>([]);
  const [appointments, setAppointments] = useState<AdminFieldAppointment[]>([]);
  const [teamMembers, setTeamMembers] = useState<AdminFieldTeamMember[]>([]);
  const [users, setUsers] = useState<AdminFieldUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('leads');
  const [teamForm, setTeamForm] = useState({
    userId: '',
    role: 'MEETING_TEAM',
    isActive: true,
  });
  const [appointmentForm, setAppointmentForm] = useState({
    leadId: '',
    assignedMeetingUserId: '',
    scheduledAt: '',
    notes: '',
  });

  const meetingTeamMembers = useMemo(
    () =>
      teamMembers.filter(
        (member) => member.role === 'MEETING_TEAM' && member.isActive,
      ),
    [teamMembers],
  );

  const todaysLeadsCount = useMemo(
    () => leads.filter((lead) => isToday(lead.createdAt)).length,
    [leads],
  );

  const todaysMeetingsCount = useMemo(
    () =>
      appointments.filter((appointment) => isToday(appointment.scheduledAt))
        .length,
    [appointments],
  );

  const statValues = [
    overview?.stats?.totalLeads ?? 0,
    overview?.stats?.pendingContacts ?? 0,
    overview?.stats?.scheduledAppointments ?? 0,
    overview?.stats?.completedMeetings ?? 0,
    todaysMeetingsCount,
    todaysLeadsCount,
  ];

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [overviewRes, leadsRes, appointmentsRes, teamRes, usersRes] =
        await Promise.all([
          getFieldAdminOverview(),
          getFieldAdminLeads(),
          getFieldAdminAppointments(),
          getFieldAdminTeamMembers(),
          getUsersForFieldOperations(),
        ]);

      setOverview(overviewRes);
      setLeads(leadsRes);
      setAppointments(appointmentsRes);
      setTeamMembers(teamRes);
      setUsers(usersRes);
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              'Failed to load field operations module'
          : 'Failed to load field operations module',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }

    loadAll();
  }, [isAuthenticated, router]);

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await updateFieldLeadStatus(leadId, status);
      await loadAll();
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to update lead status'
          : 'Failed to update lead status',
      );
    }
  };

  const handleTeamSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await upsertFieldAdminTeamMember({
        userId: teamForm.userId,
        role: teamForm.role as 'SURVEY_AGENT' | 'MEETING_TEAM',
        isActive: teamForm.isActive,
      });
      setTeamForm({ userId: '', role: 'MEETING_TEAM', isActive: true });
      await loadAll();
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to save team member'
          : 'Failed to save team member',
      );
    }
  };

  const handleAppointmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createFieldAppointment({
        leadId: appointmentForm.leadId,
        assignedMeetingUserId:
          appointmentForm.assignedMeetingUserId || undefined,
        scheduledAt: appointmentForm.scheduledAt,
        notes: appointmentForm.notes,
      });
      setAppointmentForm({
        leadId: '',
        assignedMeetingUserId: '',
        scheduledAt: '',
        notes: '',
      });
      await loadAll();
    } catch (error: unknown) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to create appointment'
          : 'Failed to create appointment',
      );
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading field operations...
      </div>
    );
  }

  return (
    <div className="space-y-6 py-3">
      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {statValues.map((value, index) => (
          <div
            key={statMeta[index].label}
            className={`group relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${statMeta[index].accent} p-5 shadow-[0_20px_55px_-28px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/60 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_60px_-28px_rgba(15,23,42,0.22)]`}
          >
            <div className="absolute inset-y-0 right-0 w-24 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95),transparent_70%)] opacity-70" />
            <div className="relative">
              <div className="inline-flex rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {statMeta[index].badge}
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">
                {statMeta[index].label}
              </p>
              <p
                className={`mt-2 text-3xl font-semibold tracking-tight ${statMeta[index].valueClass}`}
              >
                {value}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)] p-4 shadow-[0_26px_65px_-34px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/70 sm:p-5">
        <div className="mb-5 rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_58%,#fff7ed_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b45309]">
                Field workflow
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Operations control
              </h2>
            </div>
            <div className="rounded-full border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600">
              Live admin workspace
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'border-[#111827] bg-[#111827] text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.55)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {activeTab === 'leads'
            ? sectionShell(
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Leads</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review survey submissions and push them forward.
                  </p>
                  <div className="mt-5 space-y-4">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-[1.5rem] border border-slate-200/90 bg-white p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)]"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-base font-semibold text-slate-900">
                              {lead.businessName}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {lead.customerName} • {lead.mobileNumber}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {lead.businessAddress}
                            </p>
                            <p className="mt-3 inline-flex rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Submitted by {lead.createdByUser?.name || 'Field user'}
                            </p>
                          </div>
                          <div className="w-full lg:w-56">
                            <select
                              value={lead.currentStatus}
                              onChange={(e) =>
                                handleStatusChange(lead.id, e.target.value)
                              }
                              className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                            >
                              {leadStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status.replaceAll('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>,
              )
            : null}

          {activeTab === 'appointments'
            ? sectionShell(
                <>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Appointments
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    View scheduled meetings and assignment status.
                  </p>
                  <div className="mt-4 space-y-3">
                    {appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="rounded-[1.5rem] border border-slate-200/90 bg-white px-4 py-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)]"
                      >
                        <p className="font-semibold text-slate-900">
                          {appointment.lead?.businessName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {appointment.assignedMeetingUser?.name || 'Unassigned'} •{' '}
                          {new Date(appointment.scheduledAt).toLocaleString(
                            'en-IN',
                          )}
                        </p>
                        {appointment.notes ? (
                          <p className="mt-2 text-sm text-slate-500">
                            {appointment.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>,
              )
            : null}

          {activeTab === 'schedule'
            ? sectionShell(
                <form onSubmit={handleAppointmentSubmit}>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Schedule appointment
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Schedule and assign meetings to the meeting team.
                  </p>
                  <div className="mt-5 grid gap-4 md:max-w-2xl">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Lead
                      </label>
                      <select
                        required
                        value={appointmentForm.leadId}
                        onChange={(e) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            leadId: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      >
                        <option value="">Select lead</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.businessName} - {lead.customerName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Assign meeting to
                      </label>
                      <select
                        required
                        value={appointmentForm.assignedMeetingUserId}
                        onChange={(e) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            assignedMeetingUserId: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      >
                        <option value="">Select meeting team user</option>
                        {meetingTeamMembers.map((member) => (
                          <option key={member.id} value={member.userId}>
                            {member.user?.name} - {member.user?.mobileNumber}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Meeting date and time
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={appointmentForm.scheduledAt}
                        onChange={(e) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            scheduledAt: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      />
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Notes for the meeting team"
                      value={appointmentForm.notes}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                    />

                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:opacity-95"
                    >
                      Create appointment
                    </button>
                  </div>
                </form>,
              )
            : null}

          {activeTab === 'agents'
            ? (
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                {sectionShell(
                  <form onSubmit={handleTeamSubmit}>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Active field agent
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Assign existing users to survey or meeting roles.
                    </p>
                    <div className="mt-5 grid gap-4">
                      <select
                        required
                        value={teamForm.userId}
                        onChange={(e) =>
                          setTeamForm((prev) => ({
                            ...prev,
                            userId: e.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      >
                        <option value="">Select user</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} - {user.mobileNumber}
                          </option>
                        ))}
                      </select>

                      <select
                        value={teamForm.role}
                        onChange={(e) =>
                          setTeamForm((prev) => ({
                            ...prev,
                            role: e.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      >
                        <option value="SURVEY_AGENT">Survey agent</option>
                        <option value="MEETING_TEAM">Meeting team</option>
                      </select>

                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={teamForm.isActive}
                          onChange={(e) =>
                            setTeamForm((prev) => ({
                              ...prev,
                              isActive: e.target.checked,
                            }))
                          }
                        />
                        Active access
                      </label>

                      <button
                        type="submit"
                        className="inline-flex justify-center rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#fbbf24_100%)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_32px_-18px_rgba(245,158,11,0.55)] transition hover:-translate-y-0.5 hover:opacity-95"
                      >
                        Save team member
                      </button>
                    </div>
                  </form>,
                )}

                {sectionShell(
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Active field agents
                    </h2>
                    <div className="mt-4 space-y-3">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-[1.5rem] border border-slate-200/90 bg-white px-4 py-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)]"
                        >
                          <p className="font-semibold text-slate-900">
                            {member.user?.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {member.role.replace('_', ' ')} •{' '}
                            {member.user?.mobileNumber}
                          </p>
                          <p className="mt-2 inline-flex rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {member.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>,
                )}
              </div>
            )
            : null}
        </div>
      </section>
    </div>
  );
}
