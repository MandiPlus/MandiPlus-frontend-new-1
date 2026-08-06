'use client';

import type { ComponentType, SVGProps } from 'react';
import {
  FolderIcon,
  HomeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  BanknotesIcon,
  CreditCardIcon,
  DocumentTextIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  PaperAirplaneIcon,
  InboxArrowDownIcon,
  ClipboardDocumentCheckIcon,
  PhoneIcon,
  UserGroupIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
  UserCircleIcon,
  BellAlertIcon,
  LinkIcon,
  PresentationChartLineIcon,
  TicketIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

export const ADMIN_SECTIONS = [
  'dashboard',
  'users',
  'ledger',
  'app-customers',
  'account-memberships',
  'app-invoices',
  'app-quick-details',
  'app-payments',
  'app-coupons',
  'insurance-forms',
  'claims',
  'tracking',
  'trips',
  'fasttag',
  'tracking-children',
  'agent-commissions',
  'insurance-payments',
  'arrival-reports',
  'field-operations',
  'fssai-leads',
  'chat-logs',
  'notifications',
  'pdf-editor',
  'access-monitor',
  'invoice-tracking',
  'invoice-approvals',
  'insurance-learning',
  'team-logs',
  'call-routing',
  'channel-partners',
  'reports',
  'analytics',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type AdminAccessProfile = {
  role: string | null;
  isFullAdmin: boolean;
  allowedSections: AdminSection[];
  account?: {
    id: string;
    fullName: string;
    username: string;
    status: string;
    isSuperAdmin?: boolean;
  };
};

export type AdminNavItem = {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  section: AdminSection;
};

export type AdminNavGroup = {
  name: string;
  sections: AdminSection[];
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon, section: 'dashboard' },
  { name: 'Users', href: '/admin/users', icon: UsersIcon, section: 'users' },
  { name: 'Ledger', href: '/admin/ledger', icon: DocumentTextIcon, section: 'ledger' },
  { name: 'Customers', href: '/admin/app-customers', icon: UserCircleIcon, section: 'app-customers' },
  { name: 'Account Memberships', href: '/admin/account-memberships', icon: LinkIcon, section: 'account-memberships' },
  { name: 'Invoices', href: '/admin/app-invoices', icon: DevicePhoneMobileIcon, section: 'app-invoices' },
  { name: 'Quick Details', href: '/admin/quick-details', icon: InboxArrowDownIcon, section: 'app-quick-details' },
  { name: 'Payments', href: '/admin/app-payments', icon: CreditCardIcon, section: 'app-payments' },
  { name: 'Coupons', href: '/admin/app/coupons', icon: TicketIcon, section: 'app-coupons' },
  { name: 'Invoice / Insurance Forms', href: '/admin/insurance-forms', icon: FolderIcon, section: 'insurance-forms' },
  { name: 'Bin', href: '/admin/invoices/bin', icon: TrashIcon, section: 'insurance-forms' },
  { name: 'Dashboard', href: '/admin/claims', icon: ClipboardDocumentListIcon, section: 'claims' },
  { name: 'Capture Links', href: '/admin/claims/capture-links', icon: LinkIcon, section: 'claims' },
  { name: 'Tracking', href: '/admin/tracking', icon: MapPinIcon, section: 'tracking' },
  { name: 'Created Trips', href: '/admin/trips', icon: MapPinIcon, section: 'trips' },
  { name: 'Fastag', href: '/admin/operations/fasttag', icon: MapPinIcon, section: 'fasttag' },
  { name: 'Add Children', href: '/admin/operations/tracking-children', icon: UserGroupIcon, section: 'tracking-children' },
  { name: 'Agent Commissions', href: '/admin/agent-commissions', icon: BanknotesIcon, section: 'agent-commissions' },
  { name: 'Insurance Payments', href: '/admin/insurance-payments', icon: CreditCardIcon, section: 'insurance-payments' },
  { name: 'Arrival Reports', href: '/admin/arrival-reports', icon: DocumentChartBarIcon, section: 'arrival-reports' },
  { name: 'Field Operations', href: '/admin/field-operations', icon: CalendarIcon, section: 'field-operations' },
  { name: 'FSSAI Leads', href: '/admin/fssai-leads', icon: IdentificationIcon, section: 'fssai-leads' },
  { name: 'WhatsApp Chats', href: '/admin/chat-logs', icon: ChatBubbleLeftRightIcon, section: 'chat-logs' },
  { name: 'Notifications', href: '/admin/app/notifications', icon: BellAlertIcon, section: 'notifications' },
  { name: 'Invoice Approvals', href: '/admin/invoice-approvals', icon: InboxArrowDownIcon, section: 'invoice-approvals' },
  { name: 'Invoice Tracking', href: '/admin/invoice-tracking', icon: PaperAirplaneIcon, section: 'invoice-tracking' },
  { name: 'Insurance Learning', href: '/admin/insurance-learning', icon: SparklesIcon, section: 'insurance-learning' },
  { name: 'Edit Insurance PDF', href: '/admin/pdf-editor', icon: PencilSquareIcon, section: 'pdf-editor' },
  { name: 'Access Monitor', href: '/admin/access-monitor', icon: ShieldCheckIcon, section: 'access-monitor' },
  { name: 'Team Daily Logs', href: '/admin/team-logs', icon: ClipboardDocumentCheckIcon, section: 'team-logs' },
  { name: 'Call Routing', href: '/admin/call-routing', icon: PhoneIcon, section: 'call-routing' },
  { name: 'Channel Partners', href: '/admin/channel-partners', icon: UserGroupIcon, section: 'channel-partners' },
  { name: 'Sales Analytics', href: '/admin/analytics', icon: PresentationChartLineIcon, section: 'analytics' },
  { name: 'AI Reports', href: '/admin/reports', icon: SparklesIcon, section: 'reports' },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    name: 'Overview',
    sections: ['dashboard', 'analytics', 'reports'],
  },
  {
    name: 'People',
    sections: ['users', 'channel-partners', 'team-logs', 'access-monitor'],
  },
  {
    name: 'App',
    sections: [
      'app-customers',
      'account-memberships',
      'app-invoices',
      'app-quick-details',
      'app-payments',
      'app-coupons',
      'notifications',
    ],
  },
  {
    name: 'Invoices',
    sections: ['insurance-forms', 'invoice-approvals', 'invoice-tracking', 'insurance-learning', 'pdf-editor'],
  },
  {
    name: 'Finance',
    sections: ['ledger', 'insurance-payments', 'agent-commissions'],
  },
  {
    name: 'Operations',
    sections: ['tracking', 'trips', 'fasttag', 'tracking-children', 'arrival-reports', 'field-operations', 'fssai-leads'],
  },
  {
    name: 'Insurance & Claims',
    sections: ['claims'],
  },
  {
    name: 'Communications',
    sections: ['chat-logs', 'call-routing'],
  },
];

export const ADMIN_ROUTE_SECTION_MAP: Record<string, AdminSection> = {
  '/admin/dashboard': 'dashboard',
  '/admin/users': 'users',
  '/admin/ledger': 'ledger',
  '/admin/app-customers': 'app-customers',
  '/admin/account-memberships': 'account-memberships',
  '/admin/app-invoices': 'app-invoices',
  '/admin/app/notifications': 'notifications',
  '/admin/quick-details': 'app-quick-details',
  '/admin/app-payments': 'app-payments',
  '/admin/app/coupons': 'app-coupons',
  '/admin/insurance-forms': 'insurance-forms',
  '/admin/invoices/bin': 'insurance-forms',
  '/admin/claims': 'claims',
  '/admin/claims/capture-links': 'claims',
  '/admin/tracking': 'tracking',
  '/admin/trips': 'trips',
  '/admin/operations/fasttag': 'fasttag',
  '/admin/operations/tracking-children': 'tracking-children',
  '/admin/agent-commissions': 'agent-commissions',
  '/admin/insurance-payments': 'insurance-payments',
  '/admin/arrival-reports': 'arrival-reports',
  '/admin/field-operations': 'field-operations',
  '/admin/fssai-leads': 'fssai-leads',
  '/admin/chat-logs': 'chat-logs',
  '/admin/notifications': 'notifications',
  '/admin/pdf-editor': 'pdf-editor',
  '/admin/access-monitor': 'access-monitor',
  '/admin/invoice-tracking': 'invoice-tracking',
  '/admin/invoice-approvals': 'invoice-approvals',
  '/admin/insurance-learning': 'insurance-learning',
  '/admin/team-logs': 'team-logs',
  '/admin/call-routing': 'call-routing',
  '/admin/channel-partners': 'channel-partners',
  '/admin/reports': 'reports',
  '/admin/analytics': 'analytics',
  '/admin/impersonate': 'users',
};

export function getSectionForAdminPath(pathname: string): AdminSection | null {
  const exact = ADMIN_ROUTE_SECTION_MAP[pathname];
  if (exact) return exact;
  const parentPath = Object.keys(ADMIN_ROUTE_SECTION_MAP)
    .filter((route) => pathname.startsWith(`${route}/`))
    .sort((left, right) => right.length - left.length)[0];
  return parentPath ? ADMIN_ROUTE_SECTION_MAP[parentPath] : null;
}

export function getFirstAllowedAdminPath(profile: AdminAccessProfile | null): string {
  const firstItem = ADMIN_NAV_ITEMS.find((item) =>
    profile?.allowedSections?.includes(item.section),
  );
  return firstItem?.href || '/admin/login';
}
