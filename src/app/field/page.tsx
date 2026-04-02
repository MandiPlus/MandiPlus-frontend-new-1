'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  CalendarClock,
  ChartColumnBig,
  ClipboardCheck,
  UserCog2,
} from 'lucide-react';
import { FieldDashboardResponse, getFieldDashboard } from '@/features/field/api';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const quickActions = [
  {
    title: 'Add a lead',
    description: 'Capture customer details and board photo from the field.',
    href: '/field/add-lead',
    icon: ClipboardCheck,
  },
  {
    title: 'Track my leads',
    description: 'See submitted leads and whether they are contacted or scheduled.',
    href: '/field/my-leads',
    icon: ChartColumnBig,
  },
  {
    title: 'Meetings & feedback',
    description: 'Check assigned appointments and submit outcomes right after visits.',
    href: '/field/meetings',
    icon: CalendarClock,
  },
];

export default function FieldHomePage() {
  const [data, setData] = useState<FieldDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        setData(await getFieldDashboard());
      } catch (error: unknown) {
        setError(
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to load dashboard'
            : 'Failed to load dashboard',
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading field dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Unable to load field dashboard'}
      </div>
    );
  }

  const stats = [
    { label: 'My leads', value: data.stats.myLeads, tone: 'bg-amber-50 text-amber-900' },
    { label: 'Open leads', value: data.stats.openLeads, tone: 'bg-sky-50 text-sky-900' },
    { label: 'Upcoming meetings', value: data.stats.upcomingMeetings, tone: 'bg-emerald-50 text-emerald-900' },
    { label: 'Completed meetings', value: data.stats.completedMeetings, tone: 'bg-slate-100 text-slate-900' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-[2rem] bg-slate-900 px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-7 sm:py-8 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {data.profile.user.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Your role is{' '}
            <span className="font-semibold text-white">
              {data.profile.role.replace('_', ' ')}
            </span>
            . This workspace is optimized for small screens in the field and expands cleanly on laptops for review work.
          </p>
          {data.profile.accessPending ? (
            <div className="mt-4 inline-flex items-center rounded-full bg-amber-400/15 px-4 py-2 text-xs font-medium text-amber-200">
              Admin has not assigned a formal field role yet. Default survey access is active.
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] bg-white/8 p-5 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/12 p-3">
              <UserCog2 className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Performance snapshot</p>
              <p className="text-xs text-slate-300">Live from field operations</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className={`rounded-2xl px-4 py-4 ${stat.tone}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">Quick actions</p>
            <p className="mt-1 text-sm text-slate-500">
              Move quickly between capture, tracking, and visit work.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <action.icon className="h-5 w-5 text-slate-700" />
                <p className="mt-4 text-base font-semibold text-slate-900">
                  {action.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
          <p className="text-sm font-semibold text-slate-900">Recent leads</p>
          <div className="mt-4 space-y-3">
            {data.recentLeads.length === 0 ? (
              <div className="flex rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                <span className="mx-auto">No leads submitted yet.</span>
              </div>
            ) : (
              data.recentLeads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {lead.businessName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{lead.customerName}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {lead.currentStatus.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                    Added on {formatDate(lead.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
