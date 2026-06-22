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
} from '@heroicons/react/24/outline';

export const ADMIN_SECTIONS = [
  'dashboard',
  'users',
  'ledger',
  'insurance-forms',
  'claims',
  'tracking',
  'trips',
  'agent-commissions',
  'insurance-payments',
  'arrival-reports',
  'field-operations',
  'fssai-leads',
  'chat-logs',
  'pdf-editor',
  'access-monitor',
  'invoice-tracking',
  'invoice-approvals',
  'team-logs',
  'call-routing',
  'channel-partners',
  'reports',
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
  { name: 'Invoice / Insurance Forms', href: '/admin/insurance-forms', icon: FolderIcon, section: 'insurance-forms' },
  { name: 'Claim Requests', href: '/admin/claims', icon: ClipboardDocumentListIcon, section: 'claims' },
  { name: 'Tracking', href: '/admin/tracking', icon: MapPinIcon, section: 'tracking' },
  { name: 'Created Trips', href: '/admin/trips', icon: MapPinIcon, section: 'trips' },
  { name: 'Agent Commissions', href: '/admin/agent-commissions', icon: BanknotesIcon, section: 'agent-commissions' },
  { name: 'Insurance Payments', href: '/admin/insurance-payments', icon: CreditCardIcon, section: 'insurance-payments' },
  { name: 'Arrival Reports', href: '/admin/arrival-reports', icon: DocumentChartBarIcon, section: 'arrival-reports' },
  { name: 'Field Operations', href: '/admin/field-operations', icon: CalendarIcon, section: 'field-operations' },
  { name: 'FSSAI Leads', href: '/admin/fssai-leads', icon: IdentificationIcon, section: 'fssai-leads' },
  { name: 'WhatsApp Chats', href: '/admin/chat-logs', icon: ChatBubbleLeftRightIcon, section: 'chat-logs' },
  { name: 'Invoice Approvals', href: '/admin/invoice-approvals', icon: InboxArrowDownIcon, section: 'invoice-approvals' },
  { name: 'Invoice Tracking', href: '/admin/invoice-tracking', icon: PaperAirplaneIcon, section: 'invoice-tracking' },
  { name: 'Edit Insurance PDF', href: '/admin/pdf-editor', icon: PencilSquareIcon, section: 'pdf-editor' },
  { name: 'Access Monitor', href: '/admin/access-monitor', icon: ShieldCheckIcon, section: 'access-monitor' },
  { name: 'Team Daily Logs', href: '/admin/team-logs', icon: ClipboardDocumentCheckIcon, section: 'team-logs' },
  { name: 'Call Routing', href: '/admin/call-routing', icon: PhoneIcon, section: 'call-routing' },
  { name: 'Channel Partners', href: '/admin/channel-partners', icon: UserGroupIcon, section: 'channel-partners' },
  { name: 'AI Reports', href: '/admin/reports', icon: SparklesIcon, section: 'reports' },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    name: 'Overview',
    sections: ['dashboard', 'reports'],
  },
  {
    name: 'People',
    sections: ['users', 'channel-partners', 'team-logs', 'access-monitor'],
  },
  {
    name: 'Invoices',
    sections: ['insurance-forms', 'invoice-approvals', 'invoice-tracking', 'pdf-editor'],
  },
  {
    name: 'Finance',
    sections: ['ledger', 'insurance-payments', 'agent-commissions'],
  },
  {
    name: 'Operations',
    sections: ['tracking', 'trips', 'arrival-reports', 'field-operations', 'fssai-leads'],
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
  '/admin/insurance-forms': 'insurance-forms',
  '/admin/claims': 'claims',
  '/admin/tracking': 'tracking',
  '/admin/trips': 'trips',
  '/admin/agent-commissions': 'agent-commissions',
  '/admin/insurance-payments': 'insurance-payments',
  '/admin/arrival-reports': 'arrival-reports',
  '/admin/field-operations': 'field-operations',
  '/admin/fssai-leads': 'fssai-leads',
  '/admin/chat-logs': 'chat-logs',
  '/admin/pdf-editor': 'pdf-editor',
  '/admin/access-monitor': 'access-monitor',
  '/admin/invoice-tracking': 'invoice-tracking',
  '/admin/invoice-approvals': 'invoice-approvals',
  '/admin/team-logs': 'team-logs',
  '/admin/call-routing': 'call-routing',
  '/admin/channel-partners': 'channel-partners',
  '/admin/reports': 'reports',
  '/admin/impersonate': 'users',
};

export function getSectionForAdminPath(pathname: string): AdminSection | null {
  return ADMIN_ROUTE_SECTION_MAP[pathname] ?? null;
}

export function getFirstAllowedAdminPath(profile: AdminAccessProfile | null): string {
  const firstItem = ADMIN_NAV_ITEMS.find((item) =>
    profile?.allowedSections?.includes(item.section),
  );
  return firstItem?.href || '/admin/login';
}
