'use client';

import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function getAdminHeaders() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'CONFIRMED_BUYER'
  | 'INTERESTED'
  | 'FOLLOW_UP'
  | 'DEMO_BOOKED'
  | 'CONVERTED'
  | 'NOT_INTERESTED'
  | 'NOT_REACHABLE'
  | 'NOT_RELEVANT'
  | 'INVALID';

export type RejectionReason =
  | 'NO_REQUIREMENT'
  | 'ALREADY_USING_SOFTWARE'
  | 'TOO_EXPENSIVE'
  | 'NOT_DECISION_MAKER'
  | 'WRONG_BUSINESS'
  | 'NOT_ACTIVE'
  | 'DOES_NOT_NEED_BILLING'
  | 'NOT_INTERESTED'
  | 'OTHER';

export const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: 'NO_REQUIREMENT', label: 'No requirement' },
  { value: 'ALREADY_USING_SOFTWARE', label: 'Already using software' },
  { value: 'TOO_EXPENSIVE', label: 'Too expensive' },
  { value: 'NOT_DECISION_MAKER', label: 'Not decision maker' },
  { value: 'WRONG_BUSINESS', label: 'Wrong business' },
  { value: 'NOT_ACTIVE', label: 'Not active' },
  { value: 'DOES_NOT_NEED_BILLING', label: 'Does not need billing' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
  { value: 'OTHER', label: 'Other' },
];

export interface LeadPhone {
  e164: string;
  raw: string | null;
  isLandline: boolean;
  isPrimary: boolean;
}

export interface LeadRecord {
  id: string;
  displayName: string;
  region: string | null;
  commodityCode: string | null;
  role: string | null;
  review: string | null;
  status: LeadStatus;
  assignedToUserId: string | null;
  assignedToName: string | null;
  matchedUserId: string | null;
  convertedUserId: string | null;
  batchId: string | null;
  batchLabel: string | null;
  attemptCount: number;
  nextFollowUpAt: string | null;
  rejectionReason: RejectionReason | null;
  source: string;
  verificationLevel: number;
  demoAt: string | null;
  warmupSentAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  phones: LeadPhone[];
}

export interface LeadTeamMember {
  id: string;
  name: string;
  mobileNumber: string;
}

export interface LeadCommodity {
  code: string;
  label: string;
  emoji: string | null;
}

export interface LeadBatchSummary {
  id: string;
  label: string;
  insertedCount: number;
  mergedCount: number;
  matchedCustomerCount: number;
  createdAt: string;
}

export interface LeadEventRecord {
  id: string;
  type: string;
  disposition: string | null;
  note: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  byAdminName: string | null;
  createdAt: string;
}

export interface LeadReportMember {
  userId: string;
  name: string;
  calls: number;
  connected: number;
  interested: number;
  converted: number;
  followUpsSet: number;
  notInterested: number;
  openLeads: number;
  untouched: number;
  overdue: number;
}

export interface LeadReport {
  totals: {
    calls: number;
    connected: number;
    interested: number;
    converted: number;
    followUpsSet: number;
    notInterested: number;
    untouched: number;
    overdue: number;
    leadsAdded: number;
  };
  perMember: LeadReportMember[];
  perDay: { day: string; calls: number; connected: number; converted: number }[];
}

export async function getLeadReport(
  from: string,
  to: string,
): Promise<LeadReport> {
  const response = await axios.get(`${API_BASE_URL}/leads/admin/reports`, {
    params: { from, to },
    headers: getAdminHeaders(),
  });
  return response.data;
}

export interface LeadViewerInfo {
  assigneeUserId: string | null;
  assigneeName: string | null;
  adminName: string | null;
  isManager: boolean;
}

export interface QueuedLead extends LeadRecord {
  tier?: string;
  reason?: string;
}

export interface TeamMemberDay {
  userId: string;
  name: string;
  target: number;
  covered: number;
  callsToday: number;
  overdue: number;
  dueToday: number;
  hot: number;
  fresh: number;
  openLeads: number;
}

export interface TodayPlan {
  scope: 'member' | 'team';
  userId: string | null;
  name: string | null;
  target: number;
  covered: number;
  callsToday: number;
  remaining: number;
  pending: number;
  scheduledLater: number;
  nextAction: string | null;
  members?: TeamMemberDay[];
  sections: {
    overdue: QueuedLead[];
    dueNow: QueuedLead[];
    laterToday: QueuedLead[];
    hot: QueuedLead[];
    fresh: QueuedLead[];
    recall: QueuedLead[];
  };
  queue: QueuedLead[];
}

export async function getTodayPlan(userId?: string): Promise<TodayPlan> {
  const response = await axios.get(`${API_BASE_URL}/leads/admin/today`, {
    params: userId ? { userId } : undefined,
    headers: getAdminHeaders(),
  });
  return response.data;
}

export async function getLeadsBootstrap(): Promise<{
  team: LeadTeamMember[];
  batches: LeadBatchSummary[];
  commodities: LeadCommodity[];
  regions: string[];
  viewer: LeadViewerInfo;
}> {
  const response = await axios.get(`${API_BASE_URL}/leads/admin/bootstrap`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}

export async function getLeads(): Promise<LeadRecord[]> {
  const response = await axios.get(`${API_BASE_URL}/leads/admin/data`, {
    headers: getAdminHeaders(),
  });
  return response.data.leads;
}

export async function getLeadEvents(id: string): Promise<LeadEventRecord[]> {
  const response = await axios.get(
    `${API_BASE_URL}/leads/admin/${id}/events`,
    { headers: getAdminHeaders() },
  );
  return response.data.events;
}

export async function updateLead(
  id: string,
  payload: Partial<{
    displayName: string;
    region: string;
    commodityCode: string;
    role: string;
    status: LeadStatus;
    assignedToUserId: string;
    clearAssignee: boolean;
    nextFollowUpAt: string;
    clearFollowUp: boolean;
    note: string;
  }>,
): Promise<LeadRecord> {
  const response = await axios.patch(
    `${API_BASE_URL}/leads/admin/${id}`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data.lead;
}

export async function logLeadCall(
  id: string,
  payload: {
    disposition: LeadStatus;
    note?: string;
    nextFollowUpAt?: string;
    rejectionReason?: RejectionReason;
    demoAt?: string;
  },
): Promise<LeadRecord> {
  const response = await axios.post(
    `${API_BASE_URL}/leads/admin/${id}/call`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data.lead;
}

export interface LeadProfile {
  shop_name: string | null;
  contact_person: string | null;
  city: string | null;
  mandi: string | null;
  market_area: string | null;
  shop_number: string | null;
  product: string | null;
  additional_products: string | null;
  business_type: string | null;
  business_activity: string | null;
  daily_vehicles: number | null;
  weekly_vehicles: number | null;
  buying_volume: string | null;
  notes: string | null;
}

export const BUSINESS_TYPES = [
  { value: 'BUYER', label: 'Buyer' },
  { value: 'TRADER', label: 'Trader' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
  { value: 'COMMISSION_AGENT', label: 'Commission agent' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'OTHER', label: 'Other' },
];

export const BUSINESS_ACTIVITY = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SEASONAL', label: 'Seasonal' },
];

export const VERIFICATION_LEVELS: Record<number, string> = {
  1: 'Raw',
  2: 'Contact verified',
  3: 'Buyer verified',
  4: 'Fully verified',
};

export async function getLeadProfile(id: string): Promise<LeadProfile | null> {
  const response = await axios.get(
    `${API_BASE_URL}/leads/admin/${id}/profile`,
    { headers: getAdminHeaders() },
  );
  return response.data.profile;
}

export async function saveLeadProfile(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ verificationLevel: number }> {
  const response = await axios.patch(
    `${API_BASE_URL}/leads/admin/${id}/profile`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data;
}

export interface MarketContactInput {
  name: string;
  mobile: string;
  shopName?: string;
  product?: string;
  businessType?: string;
  mandi?: string;
  city?: string;
  relationship?: string;
}

export async function addMarketContacts(
  id: string,
  contacts: MarketContactInput[],
): Promise<{ created: number; duplicates: number; invalid: string[] }> {
  const response = await axios.post(
    `${API_BASE_URL}/leads/admin/${id}/contacts`,
    { contacts },
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data;
}

export type IngestVerdict =
  | 'NEW'
  | 'EXISTING_LEAD'
  | 'EXISTING_CUSTOMER'
  | 'DUPLICATE_IN_PASTE'
  | 'INVALID';

export interface IngestPreviewRow {
  name: string;
  phones: string[];
  verdict: IngestVerdict;
  detail: string | null;
}

export interface IngestPreview {
  parsed: number;
  willCreate: number;
  willMerge: number;
  alreadyCustomers: number;
  duplicatesInPaste: number;
  invalid: number;
  rows: IngestPreviewRow[];
}

export interface IngestPayload {
  batchLabel: string;
  rawText: string;
  source?: string;
  assignMode?: 'AUTO' | 'MANUAL' | 'UNASSIGNED';
  assigneeUserIds?: string[];
  defaultRegion?: string;
  defaultMandi?: string;
  defaultCommodityCode?: string;
  defaultRole?: string;
}

export const LEAD_SOURCES = [
  { value: 'SCRAPED_DATA', label: 'Scraped data' },
  { value: 'FIELD_TEAM', label: 'Field team' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'EXISTING_CUSTOMER', label: 'Existing customer' },
  { value: 'CUSTOMER_REFERENCE', label: 'Customer reference' },
  { value: 'SALES_EXECUTIVE', label: 'Sales executive' },
  { value: 'MANUAL_ENTRY', label: 'Manual entry' },
];

export async function previewIngest(
  payload: IngestPayload,
): Promise<IngestPreview> {
  const response = await axios.post(
    `${API_BASE_URL}/leads/admin/ingest/preview`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data;
}

export async function ingestLeads(payload: IngestPayload): Promise<{
  inserted: number;
  merged: number;
  matchedCustomers: number;
  assignments: Record<string, number>;
  invalidPhones: string[];
}> {
  const response = await axios.post(
    `${API_BASE_URL}/leads/admin/ingest`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data;
}

export interface CommandAlert {
  key: string;
  severity: 'red' | 'amber' | 'fire';
  count: number;
  label: string;
  detail?: string;
}

export interface CommandCenterData {
  kpis: {
    totalLeads: number;
    platformUsers: number;
    callsToday: number;
    callsYesterday: number;
    connectsToday: number;
    connectsYesterday: number;
    hot: number;
    converted: number;
  };
  runway: {
    freshRemaining: number;
    dailyCapacity: number;
    days: number | null;
  };
  attention: CommandAlert[];
  funnel: {
    stages: { key: string; label: string; count: number }[];
    worstDrop: string | null;
    inFollowUp: number;
  };
  team: TeamMemberDay[];
  teamTotals: { target: number; covered: number; callsToday: number };
  quality: {
    levels: { level: number; count: number }[];
    sources: {
      source: string;
      leads: number;
      wrongNumbers: number;
      confirmed: number;
      warm: number;
    }[];
  };
  campaign: {
    audienceReady: number;
    sent: number;
    sentToday: number;
    hotAudience: number;
  };
  opportunities: {
    id: string;
    name: string;
    status: LeadStatus;
    assignee: string | null;
    dailyVehicles: number | null;
    buyingVolume: string | null;
    mandi: string | null;
  }[];
}

export async function getCommandCenter(): Promise<CommandCenterData> {
  const response = await axios.get(`${API_BASE_URL}/leads/admin/command`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}
