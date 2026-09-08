'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  adminApi,
  type GrowthCampaign,
  type GrowthCampaignDetail,
  type GrowthFunnel,
  type GrowthOverview,
  type GrowthTemplateStat,
} from '@/features/admin/api/admin.api';

const BRAND = '#4309ac';
const IST = 'Asia/Kolkata';

const rupees = (paise: number | null | undefined) => {
  if (paise === null || paise === undefined) return '—';
  const value = paise / 100;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  })}`;
};

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value}%`;

const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        timeZone: IST,
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warn' | 'brand';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'brand'
          ? 'text-[#4309ac]'
          : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 text-sm ${right ? 'text-right' : ''} ${
        muted ? 'text-gray-500' : 'text-gray-900'
      }`}
    >
      {children}
    </td>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const marketing = category?.toUpperCase() === 'MARKETING';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        marketing
          ? 'bg-amber-100 text-amber-800'
          : 'bg-emerald-100 text-emerald-800'
      }`}
      title={
        marketing
          ? 'Marketing pricing — roughly ₹0.86 + GST per message'
          : 'Utility pricing — roughly ₹0.115 + GST per message'
      }
    >
      {category}
    </span>
  );
}

/**
 * Funnel steps are drawn against the step above them, because that is the
 * denominator each rate is actually computed with — showing every bar against
 * "sent" would make read rate look like a delivery problem.
 */
function FunnelBars({ funnel }: { funnel: GrowthFunnel }) {
  const steps = [
    { label: 'Targeted', value: funnel.targeted, rate: null as number | null },
    { label: 'Sent', value: funnel.sent, rate: null },
    { label: 'Delivered', value: funnel.delivered, rate: funnel.deliveryRate },
    { label: 'Read', value: funnel.read, rate: funnel.readRate },
    { label: 'Engaged', value: funnel.engaged, rate: funnel.engagementRate },
    { label: 'Replied', value: funnel.replied, rate: funnel.replyRate },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-medium text-gray-600">
            {step.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded bg-gray-100">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max((step.value / max) * 100, step.value > 0 ? 2 : 0)}%`,
                backgroundColor: BRAND,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-sm font-semibold text-gray-900">
            {step.value}
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-gray-500">
            {step.rate === null ? '' : pct(step.rate)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CampaignDetailPanel({ campaign }: { campaign: GrowthCampaignDetail }) {
  const { funnel, cost, conversions } = campaign;
  const humanReplies = campaign.replies.filter((r) => !r.isReaction);

  return (
    <div className="space-y-4 border-t border-gray-200 bg-gray-50 p-4">
      {!campaign.trackingComplete && campaign.trackingNote ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Partial tracking. </span>
          {campaign.trackingNote}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Funnel</h3>
          <FunnelBars funnel={funnel} />
          <p className="mt-3 text-xs text-gray-500">
            Rates are measured against{' '}
            <span className="font-semibold">{funnel.rateBasis}</span>
            {funnel.rateBasis === 'sent'
              ? ' because delivery receipts for this campaign are incomplete — measuring against delivered would inflate them.'
              : '.'}{' '}
            Read rate is a floor: WhatsApp only reports a read receipt when the
            recipient has them switched on.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Cost efficiency
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Spend (incl. GST)</p>
                <p className="text-lg font-bold text-gray-900">
                  {rupees(cost.totalPaiseIncGst)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Per reply</p>
                <p className="text-lg font-bold text-gray-900">
                  {rupees(cost.costPerReplyPaise)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Per engagement</p>
                <p className="text-lg font-bold text-gray-900">
                  {rupees(cost.costPerEngagedPaise)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Business outcomes ({conversions.windowDays}d)
            </h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Traders</p>
                <p className="text-lg font-bold text-gray-900">
                  {conversions.convertedRecipients}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Invoices</p>
                <p className="text-lg font-bold text-gray-900">
                  {conversions.invoices}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Premium</p>
                <p className="text-lg font-bold text-gray-900">
                  {rupees(conversions.premiumPaise)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Claims</p>
                <p className="text-lg font-bold text-gray-900">
                  {conversions.claims}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Same cohort in the {conversions.windowDays} days before launch:{' '}
              <span className="font-semibold text-gray-700">
                {conversions.baselineConvertedRecipients} traders /{' '}
                {conversions.baselineInvoices} invoices
              </span>
              .{' '}
              {conversions.significant
                ? `Lift ${conversions.liftPct}%.`
                : 'Too few conversions either side to call this a lift — treat as directional only.'}
              {conversions.holdoutSize === 0
                ? ' No holdout was reserved, so campaign and background activity cannot be separated.'
                : ` Holdout: ${conversions.holdoutConverted}/${conversions.holdoutSize} converted.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Replies &amp; reactions ({campaign.replies.length})
          </h3>
          {campaign.replies.length === 0 ? (
            <p className="text-sm text-gray-500">
              No inbound messages inside the {campaign.replyWindowHours}h window.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {campaign.replies.map((reply, index) => (
                <li
                  key={`${reply.phone}-${index}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {reply.name || reply.phone}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-500">
                      +{reply.hoursAfterLaunch}h
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-sm text-gray-700">
                    {reply.isReaction
                      ? (reply.content || '').replace(/->.*/, '')
                      : reply.content || `(${reply.messageType})`}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Attribution is a time window, not proof of cause — someone may have
            written in about something unrelated. Read them before counting them.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              When it got read
            </h3>
            {campaign.readCurve.length === 0 ? (
              <p className="text-sm text-gray-500">No read receipts recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={campaign.readCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hoursAfterLaunch"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: 'hours after send',
                      position: 'insideBottom',
                      offset: -4,
                      style: { fontSize: 10, fill: '#6b7280' },
                    }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="reads" fill={BRAND} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {campaign.segments.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                By commodity
              </h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <Th>Commodity</Th>
                    <Th right>Targeted</Th>
                    <Th right>Read</Th>
                    <Th right>Engaged</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaign.segments.map((segment) => (
                    <tr key={segment.value}>
                      <Td>{segment.value}</Td>
                      <Td right>{segment.targeted}</Td>
                      <Td right>{segment.read}</Td>
                      <Td right>{segment.engaged}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {campaign.failures.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Failed sends ({campaign.failures.length})
          </h3>
          <ul className="space-y-1 text-sm text-gray-700">
            {campaign.failures.slice(0, 20).map((failure) => (
              <li key={failure.phone}>
                <span className="font-medium">
                  {failure.name || failure.phone}
                </span>{' '}
                <span className="text-gray-500">
                  — {failure.errorText || 'unspecified error'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-gray-500">
        {humanReplies.length} of {campaign.replies.length} inbound events were
        written replies rather than reactions.
      </p>
    </div>
  );
}

export default function GrowthPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();

  const [tab, setTab] = useState<'campaigns' | 'overview' | 'templates'>(
    'campaigns',
  );
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [templates, setTemplates] = useState<GrowthTemplateStat[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GrowthCampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const allowed = canAccessSection('growth');

  useEffect(() => {
    if (!authLoading && isAuthenticated && !allowed) {
      router.replace('/admin/dashboard');
    }
  }, [authLoading, isAuthenticated, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const [overviewData, campaignData, templateData] = await Promise.all([
      adminApi.getGrowthOverview(days),
      adminApi.getGrowthCampaigns(),
      adminApi.getGrowthTemplates(days),
    ]);
    setOverview(overviewData);
    setCampaigns(campaignData);
    setTemplates(templateData);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    if (isAuthenticated && allowed) void load();
  }, [isAuthenticated, allowed, load]);

  const toggleCampaign = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetail(await adminApi.getGrowthCampaign(id));
    setDetailLoading(false);
  };

  const headline = useMemo(() => {
    const engaged = campaigns.reduce((sum, c) => sum + c.funnel.engaged, 0);
    const spend = campaigns.reduce(
      (sum, c) => sum + c.cost.totalPaiseIncGst,
      0,
    );
    return { engaged, spend };
  }, [campaigns]);

  if (authLoading || !isAuthenticated || !allowed) return null;

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
            <p className="mt-1 text-sm text-gray-600">
              What our WhatsApp messaging is actually producing — reach,
              conversations and the business that follows them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => void load()}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: BRAND }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Conversations started"
            value={String(headline.engaged)}
            sub="replies + reactions across campaigns"
            tone="brand"
          />
          <StatCard
            label="Campaign spend"
            value={rupees(headline.spend)}
            sub="incl. 18% GST"
          />
          <StatCard
            label="Messages sent"
            value={(overview?.totals.outboundTemplates ?? 0).toLocaleString(
              'en-IN',
            )}
            sub={`templates, last ${days}d`}
          />
          <StatCard
            label="Read rate"
            value={pct(overview?.totals.readRate)}
            sub="of delivered — a floor"
            tone="good"
          />
          <StatCard
            label="Failure rate"
            value={pct(overview?.totals.failureRate)}
            sub={`${overview?.totals.failed ?? 0} failed sends`}
            tone={
              (overview?.totals.failureRate ?? 0) > 5 ? 'warn' : 'default'
            }
          />
        </div>

        <div className="mb-4 flex gap-1 border-b border-gray-200">
          {(
            [
              ['campaigns', `Campaigns (${campaigns.length})`],
              ['overview', 'Activity'],
              ['templates', 'Templates'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === key
                  ? 'border-[#4309ac] text-[#4309ac]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading…
          </div>
        ) : null}

        {!loading && tab === 'campaigns' ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No campaigns recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Campaign</Th>
                      <Th>Template</Th>
                      <Th right>Audience</Th>
                      <Th right>Sent</Th>
                      <Th right>Delivered</Th>
                      <Th right>Read</Th>
                      <Th right>Engaged</Th>
                      <Th right>Replies</Th>
                      <Th right>Spend</Th>
                      <Th right>Per reply</Th>
                      <Th>Sent at</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.map((campaign) => (
                      <>
                        <tr
                          key={campaign.id}
                          onClick={() => void toggleCampaign(campaign.id)}
                          className={`cursor-pointer hover:bg-gray-50 ${
                            expandedId === campaign.id ? 'bg-gray-50' : ''
                          }`}
                        >
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {campaign.name}
                              </span>
                              {!campaign.trackingComplete ? (
                                <span
                                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                                  title={campaign.trackingNote || ''}
                                >
                                  partial data
                                </span>
                              ) : null}
                            </div>
                          </Td>
                          <Td muted>
                            <div className="flex items-center gap-2">
                              <span className="max-w-[220px] truncate">
                                {campaign.templateName}
                              </span>
                              <CategoryBadge
                                category={campaign.templateCategory}
                              />
                            </div>
                          </Td>
                          <Td right>{campaign.funnel.targeted}</Td>
                          <Td right>{campaign.funnel.sent}</Td>
                          <Td right>
                            {campaign.funnel.delivered}
                            <span className="ml-1 text-xs text-gray-500">
                              {pct(campaign.funnel.deliveryRate)}
                            </span>
                          </Td>
                          <Td right>
                            {campaign.funnel.read}
                            <span className="ml-1 text-xs text-gray-500">
                              {pct(campaign.funnel.readRate)}
                            </span>
                          </Td>
                          <Td right>
                            {campaign.funnel.engaged}
                            <span className="ml-1 text-xs text-gray-500">
                              {pct(campaign.funnel.engagementRate)}
                            </span>
                          </Td>
                          <Td right>{campaign.funnel.replied}</Td>
                          <Td right>{rupees(campaign.cost.totalPaiseIncGst)}</Td>
                          <Td right>{rupees(campaign.cost.costPerReplyPaise)}</Td>
                          <Td muted>{dateTime(campaign.launchedAt)}</Td>
                        </tr>
                        {expandedId === campaign.id ? (
                          <tr key={`${campaign.id}-detail`}>
                            <td colSpan={11} className="p-0">
                              {detailLoading || !detail ? (
                                <div className="border-t border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                  Loading campaign…
                                </div>
                              ) : (
                                <CampaignDetailPanel campaign={detail} />
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {!loading && tab === 'overview' && overview ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Daily messaging activity
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={overview.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="sends"
                    name="Sent"
                    stroke={BRAND}
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="read"
                    name="Read"
                    stroke="#0f766e"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="#be123c"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="inbound"
                    name="Inbound"
                    stroke="#b45309"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-gray-500">
                Sent · Read · Failed · Inbound replies, by day (IST).
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Why sends failed
              </h3>
              {overview.failureReasons.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No failures in this window.
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <Th>Reason</Th>
                      <Th right>Messages</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overview.failureReasons.map((reason) => (
                      <tr key={reason.reason}>
                        <Td>{reason.reason}</Td>
                        <Td right>{reason.count}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {!loading && tab === 'templates' ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Template</Th>
                    <Th right>Sent</Th>
                    <Th right>Delivered</Th>
                    <Th right>Read</Th>
                    <Th right>Reply rate</Th>
                    <Th right>Failure rate</Th>
                    <Th>Last sent</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((template) => (
                    <tr key={template.templateName} className="hover:bg-gray-50">
                      <Td>{template.templateName}</Td>
                      <Td right>{template.sends.toLocaleString('en-IN')}</Td>
                      <Td right>{pct(template.deliveryRate)}</Td>
                      <Td right>{pct(template.readRate)}</Td>
                      <Td right>
                        {template.replyRate === null ? (
                          <span title="Reply rate is only computed for windows of 45 days or less">
                            —
                          </span>
                        ) : (
                          pct(template.replyRate)
                        )}
                      </Td>
                      <Td right>
                        <span
                          className={
                            (template.failureRate ?? 0) > 5
                              ? 'font-semibold text-amber-700'
                              : ''
                          }
                        >
                          {pct(template.failureRate)}
                        </span>
                      </Td>
                      <Td muted>{dateTime(template.lastSentAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-gray-100 p-3 text-xs text-gray-500">
              Every outbound template, transactional ones included — this is the
              benchmark a new campaign should be read against.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
