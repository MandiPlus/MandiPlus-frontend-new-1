'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { usePathname } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import {
    ArrowPathIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    UserPlusIcon
} from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useAdmin } from '../context/AdminContext';
import { adminApi, ClaimRequest, InsuranceForm } from '../api/admin.api';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

type NotificationType = 'user_joined' | 'invoice_created' | 'claim_request' | 'pdf_regenerated';

interface NotificationItem {
    id: string;
    type: NotificationType;
    description: string;
    timestamp: string;
    href: string;
}

interface UserNotificationSource {
    _id?: string;
    id?: string;
    mobileNumber?: string;
    createdAt?: string;
}

const MAX_NOTIFICATIONS = 12;
const LAST_SEEN_STORAGE_KEY = 'adminNotificationsLastSeenAt';

const adminTitles: Record<string, string> = {
    '/admin/dashboard': 'Admin Panel',
    '/admin/users': 'Users',
    '/admin/app-customers': 'App Customers',
    '/admin/app/activity': 'App Activity',
    '/admin/account-memberships': 'Account Memberships',
    '/admin/app-invoices': 'App Invoices',
    '/admin/quick-details': 'Quick Details',
    '/admin/app-payments': 'App Payments',
    '/admin/insurance-forms': 'Invoice / Insurance Forms',
    '/admin/claims': 'Claim Requests',
    '/admin/tracking': 'Tracking',
    '/admin/trips': 'Created Trips',
    '/admin/agent-commissions': 'Agent Commissions',
    '/admin/insurance-payments': 'Insurance Payments',
    '/admin/arrival-reports': 'Arrival Reports',
    '/admin/field-operations': 'Field Operations',
    '/admin/fssai-leads': 'FSSAI Leads',
    '/admin/chat-logs': 'WhatsApp Chats',
    '/admin/pdf-editor': 'Edit Insurance PDF',
    '/admin/impersonate': 'Impersonate',
    '/admin/reports': 'AI Reports',
    '/admin/analytics': 'Sales Analytics',
    '/admin/insurance-learning': 'Insurance Learning',
};

function getTimestampValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : 0;
}

function getFirstTimestampValue(...timestamps: Array<string | undefined | null>): string {
    for (const ts of timestamps) {
        if (typeof ts === 'string' && ts.trim()) return ts;
    }
    return '';
}

function formatTimestamp(timestamp: string): string {
    const value = getTimestampValue(timestamp);
    if (!value) {
        return 'Unknown time';
    }
    return new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getNotificationTypeUi(type: NotificationType) {
    if (type === 'user_joined') {
        return {
            label: 'User',
            classes: 'bg-green-100 text-green-800',
            iconClasses: 'bg-green-100 text-green-700',
            Icon: UserPlusIcon
        };
    }
    if (type === 'invoice_created') {
        return {
            label: 'Invoice',
            classes: 'bg-blue-100 text-blue-800',
            iconClasses: 'bg-blue-100 text-blue-700',
            Icon: DocumentTextIcon
        };
    }
    if (type === 'claim_request') {
        return {
            label: 'Claim',
            classes: 'bg-amber-100 text-amber-800',
            iconClasses: 'bg-amber-100 text-amber-700',
            Icon: ExclamationTriangleIcon
        };
    }
    return {
        label: 'PDF',
        classes: 'bg-purple-100 text-purple-800',
        iconClasses: 'bg-purple-100 text-purple-700',
        Icon: ArrowPathIcon
    };
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(timestamp: string): boolean {
    const value = getTimestampValue(timestamp);
    if (!value) return false;
    return isSameDay(new Date(value), new Date());
}

function buildNotifications(users: UserNotificationSource[], invoices: InsuranceForm[], claims: ClaimRequest[]): NotificationItem[] {
    const userEvents: NotificationItem[] = users
        .filter((user) => Boolean(getFirstTimestampValue((user as any)?.createdAt, (user as any)?.created_at, (user as any)?.createdOn)))
        .map((user) => ({
            id: `user-${user.id || user._id || user.mobileNumber}`,
            type: 'user_joined' as const,
            description: `User joined: ${user.mobileNumber || 'Unknown number'}`,
            timestamp: getFirstTimestampValue((user as any)?.createdAt, (user as any)?.created_at, (user as any)?.createdOn),
            href: '/admin/users'
        }))
        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));

    const invoiceCreatedEvents: NotificationItem[] = invoices
        .filter((invoice) => Boolean(getFirstTimestampValue((invoice as any)?.createdAt, (invoice as any)?.created_at, (invoice as any)?.createdOn, (invoice as any)?.date)))
        .map((invoice) => ({
            id: `invoice-created-${invoice.id || invoice._id}`,
            type: 'invoice_created' as const,
            description: `Invoice created: ${invoice.invoiceNumber || 'N/A'} (${invoice.supplier || 'Unknown supplier'})`,
            timestamp: getFirstTimestampValue((invoice as any)?.createdAt, (invoice as any)?.created_at, (invoice as any)?.createdOn, (invoice as any)?.date),
            href: '/admin/insurance-forms'
        }))
        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));

    const pdfRegeneratedEvents: NotificationItem[] = invoices
        .filter((invoice) => {
            if (!invoice?.updatedAt || !invoice?.createdAt) return false;
            return getTimestampValue(invoice.updatedAt) - getTimestampValue(invoice.createdAt) > 60 * 1000;
        })
        .map((invoice) => ({
            id: `invoice-pdf-${invoice.id || invoice._id}`,
            type: 'pdf_regenerated' as const,
            description: `PDF regenerated: ${invoice.invoiceNumber || 'N/A'}`,
            timestamp: invoice.updatedAt,
            href: '/admin/insurance-forms'
        }))
        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));

    const claimEvents: NotificationItem[] = claims
        .filter((claim) => claim?.createdAt)
        .map((claim) => ({
            id: `claim-${claim.id}`,
            type: 'claim_request' as const,
            description: `Claim request: ${claim.invoice?.invoiceNumber || claim.invoice?.truckNumber || 'Unknown invoice'}`,
            timestamp: claim.createdAt,
            href: '/admin/claims'
        }))
        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));

    return [...userEvents, ...invoiceCreatedEvents, ...claimEvents, ...pdfRegeneratedEvents].sort(
        (a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp)
    );
}

export default function AdminHeader() {
    const { logout, isAuthenticated, canAccessSection } = useAdmin();
    const pathname = usePathname();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [lastSeenAt, setLastSeenAt] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(LAST_SEEN_STORAGE_KEY) || '';
    });

    const unreadCount = useMemo(() => {
        const lastSeen = getTimestampValue(lastSeenAt);
        if (!lastSeen) return notifications.length;
        return notifications.filter((item) => getTimestampValue(item.timestamp) > lastSeen).length;
    }, [lastSeenAt, notifications]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[AdminHeader notifications] effect', { isAuthenticated });
        }

        if (!isAuthenticated) return;

        let isMounted = true;

        const fetchNotifications = async () => {
            try {
                const [usersRes, formsRes, claimsRes] = await Promise.all([
                    canAccessSection('users')
                        ? adminApi.getUsers(1, 200)
                        : Promise.resolve({ success: true, data: { users: [] } } as any),
                    canAccessSection('insurance-forms')
                        ? adminApi.getInsuranceForms(1, 200)
                        : Promise.resolve({ success: true, data: { forms: [] } } as any),
                    canAccessSection('claims')
                        ? adminApi.getClaims()
                        : Promise.resolve({ success: true, data: [] } as any)
                ]);

                if (!isMounted) return;

                const users = (() => {
                    if (!usersRes.success) return [];
                    const payload: any = (usersRes as any).data ?? usersRes;

                    if (Array.isArray(payload)) return payload as UserNotificationSource[];
                    if (payload?.users && Array.isArray(payload.users)) return payload.users as UserNotificationSource[];
                    if (payload?.data && Array.isArray(payload.data)) return payload.data as UserNotificationSource[];
                    if (payload?.data?.users && Array.isArray(payload.data.users)) return payload.data.users as UserNotificationSource[];

                    return [];
                })();

                const invoices = (() => {
                    if (!formsRes.success) return [];
                    const payload: any = (formsRes as any).data ?? formsRes;

                    if (Array.isArray(payload)) return payload as InsuranceForm[];
                    if (payload?.forms && Array.isArray(payload.forms)) return payload.forms as InsuranceForm[];
                    if (payload?.invoices && Array.isArray(payload.invoices)) return payload.invoices as InsuranceForm[];
                    if (payload?.data && Array.isArray(payload.data)) return payload.data as InsuranceForm[];
                    if (payload?.data?.forms && Array.isArray(payload.data.forms)) return payload.data.forms as InsuranceForm[];
                    if (payload?.data?.invoices && Array.isArray(payload.data.invoices)) return payload.data.invoices as InsuranceForm[];

                    return [];
                })();

                const claims = claimsRes.success && Array.isArray(claimsRes.data) ? claimsRes.data : [];

                if (process.env.NODE_ENV !== 'production') {
                    console.log('[AdminHeader notifications] sources', {
                        users: users.length,
                        invoices: invoices.length,
                        claims: claims.length,
                        sampleUser: users[0],
                        sampleInvoice: invoices[0]
                    });
                }

                setNotifications(buildNotifications(users, invoices, claims));
            } catch (error) {
                console.error('Failed to load notifications:', error);
            }
        };

        fetchNotifications();
        const intervalId = window.setInterval(fetchNotifications, 60000);

        return () => {
            isMounted = false;
            window.clearInterval(intervalId);
        };
    }, [canAccessSection, isAuthenticated]);

    const markNotificationsAsSeen = () => {
        const now = new Date().toISOString();
        setLastSeenAt(now);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SEEN_STORAGE_KEY, now);
        }
    };

    const { todayNotifications, earlierNotifications } = useMemo(() => {
        const todayNotifications = notifications.filter((item) => isToday(item.timestamp));
        const earlierNotifications = notifications.filter((item) => !isToday(item.timestamp));
        return { todayNotifications, earlierNotifications };
    }, [notifications]);

    const headerTitle = adminTitles[pathname] || 'Admin Panel';

    return (
        <header className="bg-white shadow">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    {headerTitle === 'Admin Panel' ? (
                        <>
                            <span className="text-slate-900">Admin</span>{' '}
                            <span className="text-[#4309ac]">Panel</span>
                        </>
                    ) : (
                        <span className="text-slate-900">{headerTitle}</span>
                    )}
                </h1>
                <div className="flex items-center">
                    <Menu as="div" className="relative">
                        <div>
                            <Menu.Button
                                className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4309ac] focus:ring-offset-2"
                            >
                                <span className="sr-only">View notifications</span>
                                <BellIcon className="h-6 w-6" aria-hidden="true" />
                                {unreadCount > 0 && (
                                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </Menu.Button>
                        </div>
                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-200"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="admin-notifications-scroll absolute right-0 z-20 mt-2 max-h-[32rem] w-[24rem] overflow-y-auto origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">Notifications</div>
                                            <div className="mt-0.5 text-xs text-gray-500">Recent admin activity</div>
                                        </div>
                                    <button
                                        type="button"
                                        onClick={markNotificationsAsSeen}
                                        className="rounded-md px-2 py-1 text-xs font-semibold text-[#4309ac] hover:bg-[#4309ac]/5"
                                    >
                                        Mark all as read
                                    </button>
                                    </div>
                                </div>
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-4 text-sm text-gray-500">No recent activity found.</div>
                                ) : (
                                    <div>
                                        {todayNotifications.length > 0 && (
                                            <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Today</div>
                                        )}
                                        {todayNotifications.map((item) => {
                                            const typeUi = getNotificationTypeUi(item.type);
                                            const TypeIcon = typeUi.Icon;
                                            const isUnread = getTimestampValue(item.timestamp) > getTimestampValue(lastSeenAt);
                                            return (
                                                <Menu.Item key={item.id}>
                                                    {({ active }) => (
                                                        <Link
                                                            href={item.href}
                                                            className={classNames(
                                                                active ? 'bg-gray-50' : '',
                                                                isUnread ? 'bg-[#4309ac]/[0.04]' : '',
                                                                'group block border-b border-gray-50 px-4 py-3 transition-colors'
                                                            )}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className={classNames('mt-0.5 flex h-9 w-9 items-center justify-center rounded-full', typeUi.iconClasses)}>
                                                                    <TypeIcon className="h-5 w-5" aria-hidden="true" />
                                                                </div>

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-gray-950">
                                                                            {item.description}
                                                                        </p>
                                                                        <div className="flex items-center gap-2">
                                                                            <span
                                                                                className={classNames(
                                                                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                                                    typeUi.classes
                                                                                )}
                                                                            >
                                                                                {typeUi.label}
                                                                            </span>
                                                                            {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                                                                        </div>
                                                                    </div>
                                                                    <p className="mt-1 text-xs text-gray-500">{formatTimestamp(item.timestamp)}</p>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )}
                                                </Menu.Item>
                                            );
                                        })}

                                        {earlierNotifications.length > 0 && (
                                            <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Earlier</div>
                                        )}
                                        {earlierNotifications.map((item) => {
                                            const typeUi = getNotificationTypeUi(item.type);
                                            const TypeIcon = typeUi.Icon;
                                            const isUnread = getTimestampValue(item.timestamp) > getTimestampValue(lastSeenAt);
                                            return (
                                                <Menu.Item key={item.id}>
                                                    {({ active }) => (
                                                        <Link
                                                            href={item.href}
                                                            className={classNames(
                                                                active ? 'bg-gray-50' : '',
                                                                isUnread ? 'bg-[#4309ac]/[0.04]' : '',
                                                                'group block border-b border-gray-50 px-4 py-3 transition-colors'
                                                            )}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className={classNames('mt-0.5 flex h-9 w-9 items-center justify-center rounded-full', typeUi.iconClasses)}>
                                                                    <TypeIcon className="h-5 w-5" aria-hidden="true" />
                                                                </div>

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-gray-950">
                                                                            {item.description}
                                                                        </p>
                                                                        <div className="flex items-center gap-2">
                                                                            <span
                                                                                className={classNames(
                                                                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                                                    typeUi.classes
                                                                                )}
                                                                            >
                                                                                {typeUi.label}
                                                                            </span>
                                                                            {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                                                                        </div>
                                                                    </div>
                                                                    <p className="mt-1 text-xs text-gray-500">{formatTimestamp(item.timestamp)}</p>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )}
                                                </Menu.Item>
                                            );
                                        })}
                                    </div>
                                )}
                            </Menu.Items>
                        </Transition>
                    </Menu>

                    {/* Profile dropdown */}
                    <Menu as="div" className="relative ml-3">
                        <div>
                            <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac] focus:ring-offset-2">
                                <span className="sr-only">Open user menu</span>
                                <div className="h-8 w-8 rounded-full bg-[#4309ac]/10 flex items-center justify-center">
                                    <span className="text-[#4309ac] font-semibold">A</span>
                                </div>
                            </Menu.Button>
                        </div>
                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-200"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={logout}
                                            className={classNames(
                                                active ? 'bg-gray-100' : '',
                                                'block w-full px-4 py-2 text-left text-sm text-gray-700'
                                            )}
                                        >
                                            Sign out
                                        </button>
                                    )}
                                </Menu.Item>
                            </Menu.Items>
                        </Transition>
                    </Menu>
                </div>
            </div>
        </header>
    );
}
