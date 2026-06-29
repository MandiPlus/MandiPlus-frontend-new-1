'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminFieldAppointment,
  AdminFieldLead,
  AdminFieldOverview,
  AdminFieldPriorityLead,
  AdminFieldTeamMember,
  AdminFieldUser,
  createFieldAppointment,
  getFieldAdminAppointments,
  getFieldAdminLeads,
  getFieldAdminOverview,
  getFieldAdminPriorityLeads,
  getFieldAdminTeamMembers,
  getUsersForFieldOperations,
  sendFieldAppointmentAlert,
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
  'commission_buyer',
  'converted',
  'not_receiving_call',
  'not_interested',
  'follow_up_required',
  'closed',
];

const tabs = [
  { key: 'leads', label: 'Leads' },
  { key: 'priority', label: 'Mandi Data' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'schedule', label: 'Schedule appointment' },
  { key: 'agents', label: 'Active field agent' },
] as const;

const statMeta = [
  {
    label: 'Total leads',
    accent: 'from-[#fff7ed] via-white to-white',
    valueClass: 'text-[#c2410c]',
  },
  {
    label: 'Pending contacts',
    accent: 'from-[#fef3c7] via-white to-white',
    valueClass: 'text-[#a16207]',
  },
  {
    label: 'Scheduled appointments',
    accent: 'from-[#eff6ff] via-white to-white',
    valueClass: 'text-[#1d4ed8]',
  },
  {
    label: 'Completed meetings',
    accent: 'from-[#ecfdf5] via-white to-white',
    valueClass: 'text-[#047857]',
  },
  {
    label: "Today's meetings",
    accent: 'from-[#eef2ff] via-white to-white',
    valueClass: 'text-[#5b21b6]',
  },
  {
    label: "Today's leads",
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

function formatStatusLabel(status: string) {
  return status.replaceAll('_', ' ').toUpperCase();
}

function normalizeStatusValue(status: string) {
  return status.trim().toLowerCase().replaceAll(' ', '_');
}

function hasBoardPhoto(lead: AdminFieldLead) {
  return Boolean(lead.boardPhotoUrl?.trim());
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
  const [priorityLeads, setPriorityLeads] = useState<AdminFieldPriorityLead[]>([]);
  const [appointments, setAppointments] = useState<AdminFieldAppointment[]>([]);
  const [teamMembers, setTeamMembers] = useState<AdminFieldTeamMember[]>([]);
  const [users, setUsers] = useState<AdminFieldUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('leads');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [priorityCommodity, setPriorityCommodity] = useState('');
  const [prioritySort, setPrioritySort] = useState<{
    key: keyof AdminFieldPriorityLead | 'addedBy';
    direction: 'asc' | 'desc';
  }>({ key: 'createdAt', direction: 'desc' });
  const [priorityPage, setPriorityPage] = useState(1);
  const [sendingAlertId, setSendingAlertId] = useState('');
  const [selectedBoardPhoto, setSelectedBoardPhoto] = useState<{
    url: string;
    businessName: string;
  } | null>(null);
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

  const priorityCommodityOptions = useMemo(
    () =>
      Array.from(new Set(priorityLeads.map((lead) => lead.commodity))).sort(),
    [priorityLeads],
  );

  const filteredPriorityLeads = useMemo(() => {
    const query = prioritySearch.trim().toLowerCase();
    const filtered = priorityLeads.filter((lead) => {
      const matchesCommodity =
        !priorityCommodity || lead.commodity === priorityCommodity;
      const haystack = [
        lead.commodity,
        lead.mandiName,
        lead.biggestBuyerName,
        lead.transporterName,
        lead.regionSourceArea,
        lead.createdByUser?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesCommodity && (!query || haystack.includes(query));
    });

    return [...filtered].sort((left, right) => {
      const direction = prioritySort.direction === 'asc' ? 1 : -1;
      const leftValue =
        prioritySort.key === 'addedBy'
          ? left.createdByUser?.name || ''
          : left[prioritySort.key];
      const rightValue =
        prioritySort.key === 'addedBy'
          ? right.createdByUser?.name || ''
          : right[prioritySort.key];

      if (prioritySort.key === 'trucksPerDay' || prioritySort.key === 'todayPrice') {
        return (Number(leftValue) - Number(rightValue)) * direction;
      }

      return String(leftValue ?? '').localeCompare(String(rightValue ?? '')) * direction;
    });
  }, [priorityCommodity, priorityLeads, prioritySearch, prioritySort]);

  const priorityPageSize = 10;
  const priorityTotalPages = Math.max(
    1,
    Math.ceil(filteredPriorityLeads.length / priorityPageSize),
  );
  const pagedPriorityLeads = filteredPriorityLeads.slice(
    (priorityPage - 1) * priorityPageSize,
    priorityPage * priorityPageSize,
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [
        overviewRes,
        leadsRes,
        priorityLeadsRes,
        appointmentsRes,
        teamRes,
        usersRes,
      ] =
        await Promise.all([
          getFieldAdminOverview(),
          getFieldAdminLeads(),
          getFieldAdminPriorityLeads(),
          getFieldAdminAppointments(),
          getFieldAdminTeamMembers(),
          getUsersForFieldOperations(),
        ]);

      setOverview(overviewRes);
      setLeads(leadsRes);
      setPriorityLeads(priorityLeadsRes);
      setAppointments(appointmentsRes);
      setTeamMembers(teamRes);
      setUsers(usersRes);
    } catch (loadError: unknown) {
      setError(
        axios.isAxiosError(loadError)
          ? loadError.response?.data?.message ||
              'Failed to load field operations module'
          : 'Failed to load field operations module',
      );
    } finally {
      setLoading(false);
    }
  };

  const setPrioritySortKey = (key: keyof AdminFieldPriorityLead | 'addedBy') => {
    setPrioritySort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const exportPriorityCsv = () => {
    const headers = [
      'Commodity',
      'Mandi',
      'Biggest Buyer',
      'Transporter',
      'Trucks/Day',
      'Region',
      'Today Price',
      'Added By',
      'Date',
    ];
    const rows = filteredPriorityLeads.map((lead) => [
      lead.commodity,
      lead.mandiName,
      lead.biggestBuyerName,
      lead.transporterName,
      lead.trucksPerDay,
      lead.regionSourceArea,
      lead.todayPrice,
      lead.createdByUser?.name || 'Field user',
      new Date(lead.createdAt).toLocaleString('en-IN'),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mandi-data-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
    } catch (updateError: unknown) {
      setError(
        axios.isAxiosError(updateError)
          ? updateError.response?.data?.message || 'Failed to update lead status'
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
    } catch (teamError: unknown) {
      setError(
        axios.isAxiosError(teamError)
          ? teamError.response?.data?.message || 'Failed to save team member'
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
    } catch (appointmentError: unknown) {
      setError(
        axios.isAxiosError(appointmentError)
          ? appointmentError.response?.data?.message ||
              'Failed to create appointment'
          : 'Failed to create appointment',
      );
    }
  };

  const handleSendAppointmentAlert = async (appointmentId: string) => {
    try {
      setSendingAlertId(appointmentId);
      setError('');
      await sendFieldAppointmentAlert(appointmentId);
      await loadAll();
    } catch (alertError: unknown) {
      setError(
        axios.isAxiosError(alertError)
          ? alertError.response?.data?.message || 'Failed to send WhatsApp alert'
          : 'Failed to send WhatsApp alert',
      );
    } finally {
      setSendingAlertId('');
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
              <p className="text-sm font-medium text-slate-500">
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
                  <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white shadow-[0_18px_38px_-28px_rgba(15,23,42,0.18)]">
                    <div className="overflow-x-auto">
                      <table className="min-w-[1120px] border-separate border-spacing-0">
                        <thead>
                          <tr className="bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] text-left">
                            {[
                              'Type',
                              'Name / Commodity',
                              'Customer / Buyer',
                              'Phone / Transporter',
                              'Address / Region',
                              'Business / Mandi',
                              'Volume / Price',
                              'Submitted By',
                              'Date',
                              'Status',
                              'Board',
                            ].map((label) => (
                              <th
                                key={label}
                                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead) => {
                            const isMandiData =
                              lead.leadSource === 'MANDI_DATA';
                            const isFssaiLead =
                              lead.leadSource === 'FSSAI_LEAD';

                            return (
                              <tr
                                key={lead.id}
                                className="align-top transition hover:bg-slate-50/70"
                              >
                                <td className="border-t border-slate-200/80 px-4 py-4">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                      isMandiData
                                        ? 'bg-[#fff7ed] text-[#b45309]'
                                        : isFssaiLead
                                          ? 'bg-[#eef2ff] text-[#4338ca]'
                                        : 'bg-[#eef2ff] text-[#4338ca]'
                                    }`}
                                  >
                                    {isMandiData
                                      ? 'Mandi Data'
                                      : isFssaiLead
                                        ? 'FSSAI Lead'
                                        : 'Lead'}
                                  </span>
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm font-semibold text-slate-900">
                                  {isMandiData
                                    ? lead.mandiData?.commodity
                                    : isFssaiLead
                                      ? lead.fssaiData?.businessName
                                    : lead.businessName}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {isMandiData
                                    ? lead.mandiData?.biggestBuyerName
                                    : isFssaiLead
                                      ? lead.fssaiData?.companyEmail
                                    : lead.customerName}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {isMandiData
                                    ? lead.mandiData?.transporterName
                                    : isFssaiLead
                                      ? lead.fssaiData?.companyPhone
                                    : lead.mobileNumber}
                                </td>
                                <td className="max-w-[260px] border-t border-slate-200/80 px-4 py-4 text-sm text-slate-600">
                                  {isMandiData
                                    ? lead.mandiData?.regionSourceArea
                                    : isFssaiLead
                                      ? lead.fssaiData?.businessAddress
                                    : lead.businessAddress}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {isMandiData
                                    ? lead.mandiData?.mandiName
                                    : isFssaiLead
                                      ? lead.fssaiData?.kindOfBusiness
                                    : lead.businessType || '-'}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {isMandiData
                                    ? `${lead.mandiData?.trucksPerDay} trucks/day | Rs ${Number(
                                        lead.mandiData?.todayPrice || 0,
                                      ).toLocaleString('en-IN')}`
                                    : isFssaiLead
                                      ? 'Certificate data'
                                    : '-'}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {lead.createdByUser?.name || 'Field user'}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500">
                                  {new Date(lead.createdAt).toLocaleDateString(
                                    'en-IN',
                                  )}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4">
                                  {isMandiData || isFssaiLead ? (
                                    <span className="inline-flex rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b45309]">
                                      {isMandiData ? 'Mandi Data' : 'FSSAI Lead'}
                                    </span>
                                  ) : (
                                    <select
                                      value={lead.currentStatus}
                                      onChange={(event) =>
                                        handleStatusChange(
                                          lead.id,
                                          normalizeStatusValue(
                                            event.target.value,
                                          ),
                                        )
                                      }
                                      className="min-w-[160px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-800 outline-none transition focus:border-slate-900"
                                    >
                                      {leadStatuses.map((status) => (
                                        <option key={status} value={status}>
                                          {formatStatusLabel(status)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4">
                                  {hasBoardPhoto(lead) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedBoardPhoto({
                                          url: lead.boardPhotoUrl ?? '',
                                          businessName: lead.businessName,
                                        })
                                      }
                                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-300 hover:bg-white"
                                    >
                                      View
                                    </button>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-400">
                                      -
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {leads.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        No leads found.
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5 hidden space-y-4">
                    {leads.map((lead) => {
                      const isMandiData = lead.leadSource === 'MANDI_DATA';

                      return (
                      <div
                        key={lead.id}
                        className="rounded-[1.5rem] border border-slate-200/90 bg-white p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)]"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
                            {hasBoardPhoto(lead) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBoardPhoto({
                                    url: lead.boardPhotoUrl ?? '',
                                    businessName: lead.businessName,
                                  })
                                }
                                className="group block w-full max-w-[220px] overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-50"
                              >
                                <img
                                  src={lead.boardPhotoUrl ?? ''}
                                  alt={`${lead.businessName} board`}
                                  className="h-40 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                                />
                                <div className="border-t border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  View board photo
                                </div>
                              </button>
                            ) : (
                              <div className="flex h-40 w-full max-w-[220px] items-center justify-center rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {isMandiData ? 'Mandi Data' : 'No board photo'}
                              </div>
                            )}
                            <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">
                                {isMandiData
                                  ? lead.mandiData?.commodity
                                  : lead.businessName}
                              </p>
                              {isMandiData ? (
                                <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                                  Mandi Data
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {lead.customerName} • {lead.mobileNumber}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {lead.businessAddress}
                            </p>
                            {lead.businessType ? (
                              <p className="mt-2 text-sm font-medium text-slate-500">
                                {lead.businessType}
                              </p>
                            ) : null}
                            <p className="mt-3 inline-flex rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Submitted by {lead.createdByUser?.name || 'Field user'}
                            </p>
                            </div>
                          </div>
                          <div className="w-full lg:w-56">
                            <div className="rounded-[1.25rem] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Status
                              </p>
                              <select
                                disabled={isMandiData}
                                value={lead.currentStatus}
                                onChange={(event) =>
                                  handleStatusChange(
                                    lead.id,
                                    normalizeStatusValue(event.target.value),
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-800 outline-none transition focus:border-slate-900"
                              >
                                {leadStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </>,
              )
            : null}

          {activeTab === 'priority'
            ? sectionShell(
                <>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Mandi Data
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Commodity intelligence submitted by field teams.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={exportPriorityCsv}
                      className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Export CSV
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
                    <input
                      value={prioritySearch}
                      onChange={(event) => {
                        setPrioritySearch(event.target.value);
                        setPriorityPage(1);
                      }}
                      placeholder="Search commodity, mandi, buyer, transporter, region..."
                      className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                    />
                    <select
                      value={priorityCommodity}
                      onChange={(event) => {
                        setPriorityCommodity(event.target.value);
                        setPriorityPage(1);
                      }}
                      className="rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                    >
                      <option value="">All commodities</option>
                      {priorityCommodityOptions.map((commodity) => (
                        <option key={commodity} value={commodity}>
                          {commodity}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white shadow-[0_18px_38px_-28px_rgba(15,23,42,0.18)]">
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                          <tr className="bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] text-left">
                            {[
                              ['commodity', 'Commodity'],
                              ['mandiName', 'Mandi'],
                              ['biggestBuyerName', 'Biggest Buyer'],
                              ['transporterName', 'Transporter'],
                              ['trucksPerDay', 'Trucks/Day'],
                              ['regionSourceArea', 'Region'],
                              ['todayPrice', 'Today Price'],
                              ['addedBy', 'Added By'],
                              ['createdAt', 'Date'],
                            ].map(([key, label]) => (
                              <th
                                key={key}
                                className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrioritySortKey(
                                      key as keyof AdminFieldPriorityLead | 'addedBy',
                                    )
                                  }
                                  className="inline-flex items-center gap-1"
                                >
                                  {label}
                                  <span className="text-slate-300">
                                    {prioritySort.key === key
                                      ? prioritySort.direction === 'asc'
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedPriorityLeads.map((lead) => (
                            <tr key={lead.id} className="align-top hover:bg-slate-50/60">
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm font-semibold text-slate-900">
                                {lead.commodity}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.mandiName}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.biggestBuyerName}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.transporterName}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.trucksPerDay}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.regionSourceArea}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm font-semibold text-slate-900">
                                ₹{Number(lead.todayPrice).toLocaleString('en-IN')}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                {lead.createdByUser?.name || 'Field user'}
                              </td>
                              <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500">
                                {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 p-3 lg:hidden">
                      {pagedPriorityLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="rounded-[1.4rem] border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">
                                {lead.commodity}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {lead.mandiName} • {lead.regionSourceArea}
                              </p>
                            </div>
                            <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#b45309]">
                              ₹{Number(lead.todayPrice).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Biggest Buyer
                              </p>
                              <p className="mt-1 font-medium text-slate-800">
                                {lead.biggestBuyerName}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Transporter
                              </p>
                              <p className="mt-1 font-medium text-slate-800">
                                {lead.transporterName}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Trucks/Day
                              </p>
                              <p className="mt-1 font-medium text-slate-800">
                                {lead.trucksPerDay}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Added By
                              </p>
                              <p className="mt-1 font-medium text-slate-800">
                                {lead.createdByUser?.name || 'Field user'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredPriorityLeads.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        No mandi data found.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing {pagedPriorityLeads.length} of{' '}
                      {filteredPriorityLeads.length} mandi data records
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPriorityPage((page) => Math.max(1, page - 1))}
                        disabled={priorityPage === 1}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span className="text-sm font-medium text-slate-600">
                        {priorityPage} / {priorityTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPriorityPage((page) =>
                            Math.min(priorityTotalPages, page + 1),
                          )
                        }
                        disabled={priorityPage === priorityTotalPages}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>,
              )
            : null}

          {activeTab === 'appointments'
            ? sectionShell(
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Appointments
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        View scheduled meetings and manually send WhatsApp alerts.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white shadow-[0_18px_38px_-28px_rgba(15,23,42,0.18)]">
                    {appointments.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-0">
                          <thead>
                            <tr className="bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] text-left">
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Lead
                              </th>
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Meeting team
                              </th>
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Schedule
                              </th>
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Status
                              </th>
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Notes
                              </th>
                              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Alert
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {appointments.map((appointment) => (
                              <tr
                                key={appointment.id}
                                className="align-top transition hover:bg-slate-50/60"
                              >
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  <p className="font-semibold text-slate-900">
                                    {appointment.lead?.businessName || '-'}
                                  </p>
                                  <p className="mt-1 text-slate-500">
                                    {appointment.lead?.customerName || '-'}
                                  </p>
                                  <p className="mt-1 text-slate-500">
                                    {appointment.lead?.mobileNumber || '-'}
                                  </p>
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  <p className="font-medium text-slate-900">
                                    {appointment.assignedMeetingUser?.name || 'Unassigned'}
                                  </p>
                                  <p className="mt-1 text-slate-500">
                                    {appointment.assignedMeetingUser?.mobileNumber || '-'}
                                  </p>
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm text-slate-700">
                                  {new Date(appointment.scheduledAt).toLocaleString('en-IN')}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4 text-sm">
                                  <span className="inline-flex rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4338ca]">
                                    {formatStatusLabel(appointment.status || 'scheduled')}
                                  </span>
                                </td>
                                <td className="max-w-[260px] border-t border-slate-200/80 px-4 py-4 text-sm text-slate-600">
                                  {appointment.notes || '-'}
                                </td>
                                <td className="border-t border-slate-200/80 px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSendAppointmentAlert(appointment.id)
                                    }
                                    disabled={
                                      !appointment.assignedMeetingUserId ||
                                      sendingAlertId === appointment.id
                                    }
                                    className="inline-flex min-w-[120px] justify-center rounded-xl border border-[#f59e0b]/30 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_100%)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b45309] transition hover:border-[#f59e0b] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {sendingAlertId === appointment.id
                                      ? 'Sending...'
                                      : 'Send alert'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        No meetings scheduled yet.
                      </div>
                    )}
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
                        onChange={(event) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            leadId: event.target.value,
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
                        onChange={(event) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            assignedMeetingUserId: event.target.value,
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
                        onChange={(event) =>
                          setAppointmentForm((prev) => ({
                            ...prev,
                            scheduledAt: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
                      />
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Notes for the meeting team"
                      value={appointmentForm.notes}
                      onChange={(event) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          notes: event.target.value,
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
                        onChange={(event) =>
                          setTeamForm((prev) => ({
                            ...prev,
                            userId: event.target.value,
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
                        onChange={(event) =>
                          setTeamForm((prev) => ({
                            ...prev,
                            role: event.target.value,
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
                          onChange={(event) =>
                            setTeamForm((prev) => ({
                              ...prev,
                              isActive: event.target.checked,
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

      {selectedBoardPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedBoardPhoto(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_-30px_rgba(15,23,42,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedBoardPhoto.businessName}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  Board photo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBoardPhoto(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="bg-slate-100 p-4">
              <img
                src={selectedBoardPhoto.url}
                alt={`${selectedBoardPhoto.businessName} board`}
                className="max-h-[75vh] w-full rounded-[1.5rem] object-contain bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
