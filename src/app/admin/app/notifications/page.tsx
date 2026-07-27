'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  UserRound,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AdminCustomerNotification,
  AdminCustomerNotificationDeliveryStatus,
  AdminLedgerUser,
  adminApi,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

const MAX_TITLE_LENGTH = 180;
const MAX_BODY_LENGTH = 1200;
const MAX_LINK_LENGTH = 2048;
const MANDIPLUS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mandiplus.customer';

function normalizeHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function linkDestinationLabel(value: string) {
  const normalized = normalizeHttpsUrl(value);
  if (!normalized) return null;

  try {
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function notificationStatusTone(status: AdminCustomerNotificationDeliveryStatus) {
  if (status === 'sent') {
    return {
      label: 'Sent',
      icon: CheckCircle2,
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    };
  }
  if (status === 'no_token') {
    return {
      label: 'No token',
      icon: AlertTriangle,
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
  }
  if (status === 'failed') {
    return {
      label: 'Failed',
      icon: XCircle,
      className: 'bg-rose-50 text-rose-700 ring-rose-200',
    };
  }
  return {
    label: 'Pending',
    icon: Clock3,
    className: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not sent yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUserOption(user: AdminLedgerUser) {
  const name = user.name || 'Unnamed customer';
  const role = user.identity ? ` - ${user.identity}` : '';
  return `${name} - ${user.mobileNumber}${role}`;
}

function StatusBadge({ status }: { status: AdminCustomerNotificationDeliveryStatus }) {
  const tone = notificationStatusTone(status);
  const Icon = tone.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {tone.label}
    </span>
  );
}

export default function AdminNotificationsPage() {
  const { isAuthenticated, loading } = useAdmin();
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<AdminLedgerUser[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminLedgerUser | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [title, setTitle] = useState('MandiPlus update');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [recentNotifications, setRecentNotifications] = useState<AdminCustomerNotification[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<AdminCustomerNotification | null>(null);

  const normalizedMobile = useMemo(() => normalizeMobile(mobileNumber), [mobileNumber]);
  const normalizedLink = useMemo(() => normalizeHttpsUrl(linkUrl), [linkUrl]);
  const linkError = linkUrl.trim().length > 0 && normalizedLink === null;
  const linkDestination = useMemo(() => linkDestinationLabel(linkUrl), [linkUrl]);
  const canSend =
    normalizedMobile.length === 10 &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !linkError &&
    !sending;
  const remainingBody = MAX_BODY_LENGTH - body.length;

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    const response = await adminApi.getAdminNotifications(40);
    if (response.success) {
      setRecentNotifications(response.data || []);
    } else {
      toast.error(response.message || 'Could not load recent notifications');
    }
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const timeoutId = window.setTimeout(() => {
        void loadRecent();
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [isAuthenticated, loadRecent, loading]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (query.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchingCustomers(true);
      const response = await adminApi.searchUsers(query, 8);
      setCustomerResults(response.success ? response.data || [] : []);
      setSearchingCustomers(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [customerQuery]);

  const selectCustomer = (user: AdminLedgerUser) => {
    setSelectedCustomer(user);
    setMobileNumber(user.mobileNumber || '');
    setCustomerQuery(formatUserOption(user));
    setCustomerResults([]);
  };

  const visibleCustomerResults = customerQuery.trim().length >= 2 ? customerResults : [];
  const showCustomerSpinner = customerQuery.trim().length >= 2 && searchingCustomers;

  const handleMobileChange = (value: string) => {
    setMobileNumber(value);
    if (selectedCustomer && normalizeMobile(value) !== normalizeMobile(selectedCustomer.mobileNumber || '')) {
      setSelectedCustomer(null);
    }
  };

  const applyPlayStorePreset = () => {
    setTitle('MandiPlus update available');
    setBody('Tap to update your app.');
    setLinkUrl(MANDIPLUS_PLAY_STORE_URL);
  };

  const sendNotification = async () => {
    if (!canSend) return;
    setSending(true);
    const response = await adminApi.sendCustomerNotification({
      mobileNumber: normalizedMobile,
      title: title.trim(),
      body: body.trim(),
      type: normalizedLink === MANDIPLUS_PLAY_STORE_URL ? 'APP_UPDATE' : 'MANUAL',
      payload: {
        screen: 'notifications',
        source: 'admin-dashboard',
        ...(normalizedLink ? { url: normalizedLink } : {}),
      },
    });

    if (response.success && response.data) {
      setLastSent(response.data);
      setRecentNotifications((current) => [response.data as AdminCustomerNotification, ...current.filter((item) => item.id !== response.data?.id)].slice(0, 40));
      if (response.data.deliveryStatus === 'sent') {
        toast.success('Notification sent');
      } else if (response.data.deliveryStatus === 'no_token') {
        toast('Saved, but this customer has no active app token yet');
      } else {
        toast.error(response.data.errorMessage || 'Notification could not be delivered');
      }
      setBody('');
      setLinkUrl('');
    } else {
      toast.error(response.message || 'Notification send failed');
    }
    setSending(false);
  };

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-2 py-4 sm:px-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <BellRing className="h-4 w-4" />
            Customer app push
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Send a direct app notification to any registered customer mobile number.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRecent()}
          disabled={loadingRecent}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loadingRecent ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-bold text-slate-950">Compose</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Search customer
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setSelectedCustomer(null);
                  }}
                  placeholder="Search name or mobile number"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                {showCustomerSpinner ? (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />
                ) : null}
              </div>
              {visibleCustomerResults.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {visibleCustomerResults.map((user) => (
                    <button
                      key={user.id || user._id || user.mobileNumber}
                      type="button"
                      onClick={() => selectCustomer(user)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {user.name || 'Unnamed customer'}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {user.identity || 'Customer'} - {user.state || 'No state'}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {user.mobileNumber}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Mobile number
              </label>
              <div className="relative">
                <Smartphone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={mobileNumber}
                  onChange={(event) => handleMobileChange(event.target.value)}
                  inputMode="tel"
                  placeholder="9022353647"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${normalizedMobile.length === 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {normalizedMobile.length === 10 ? `Ready: ${normalizedMobile}` : 'Enter a 10 digit mobile'}
                </span>
                {selectedCustomer ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                    <UserRound className="h-3.5 w-3.5" />
                    {selectedCustomer.name || selectedCustomer.mobileNumber}
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Title
                </label>
                <span className="text-xs text-slate-400">{title.length}/{MAX_TITLE_LENGTH}</span>
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder="Notification title"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Message
                </label>
                <span className={`text-xs ${remainingBody < 80 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {body.length}/{MAX_BODY_LENGTH}
                </span>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
                placeholder="Write the customer-facing notification content"
                rows={8}
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="notification-link" className="block text-sm font-semibold text-slate-700">
                  Open link on tap <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={applyPlayStorePreset}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Use Play Store update
                </button>
              </div>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="notification-link"
                  type="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value.slice(0, MAX_LINK_LENGTH))}
                  placeholder="https://example.com/page"
                  aria-invalid={linkError}
                  aria-describedby="notification-link-help"
                  className={`h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:ring-2 ${
                    linkError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-100'
                  }`}
                />
              </div>
              <p
                id="notification-link-help"
                className={`mt-1.5 text-xs ${linkError ? 'font-medium text-rose-600' : 'text-slate-500'}`}
              >
                {linkError
                  ? 'Enter a complete secure link beginning with https://'
                  : 'Leave blank to open the app notifications. Secure https:// links only.'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Preview
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {title.trim() || 'Notification title'}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-600">
                      {body.trim() || 'Message content will appear here.'}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      {linkDestination ? (
                        <>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Opens {linkDestination}
                        </>
                      ) : (
                        <>
                          <BellRing className="h-3.5 w-3.5" />
                          Opens app notifications
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {lastSent ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Last send</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {lastSent.user?.mobileNumber || normalizedMobile} - {formatDateTime(lastSent.sentAt || lastSent.createdAt)}
                  </p>
                  {lastSent.errorMessage ? (
                    <p className="mt-1 text-xs text-rose-600">{lastSent.errorMessage}</p>
                  ) : null}
                </div>
                <StatusBadge status={lastSent.deliveryStatus} />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void sendNotification()}
              disabled={!canSend}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send notification
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Recent notifications</h2>
              <p className="text-xs text-slate-500">{recentNotifications.length} latest records</p>
            </div>
            {loadingRecent ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
          </div>

          <div className="max-h-[calc(100vh-190px)] overflow-y-auto">
            {recentNotifications.length === 0 && !loadingRecent ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <BellRing className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-900">No notifications yet</p>
                <p className="mt-1 text-sm text-slate-500">Sent customer app notifications will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentNotifications.map((item) => (
                  <article key={item.id} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-950">{item.title}</p>
                          <StatusBadge status={item.deliveryStatus} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{item.body}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {item.user?.name || 'Unknown customer'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5" />
                        {item.user?.mobileNumber || 'No mobile'}
                      </span>
                      <span>{formatDateTime(item.sentAt || item.createdAt)}</span>
                    </div>
                    {item.errorMessage ? (
                      <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                        {item.errorMessage}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
