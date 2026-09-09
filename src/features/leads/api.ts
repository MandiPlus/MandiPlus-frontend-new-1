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
  | 'FOLLOW_UP'
  | 'INTERESTED'
  | 'CONVERTED'
  | 'NOT_INTERESTED'
  | 'NOT_REACHABLE'
  | 'INVALID';

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
  isManager: boolean;
  dailyTarget: number;
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

export async function setDailyTarget(userId: string, dailyTarget: number) {
  const response = await axios.patch(
    `${API_BASE_URL}/leads/admin/targets/${userId}`,
    { dailyTarget },
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
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
  payload: { disposition: LeadStatus; note?: string; nextFollowUpAt?: string },
): Promise<LeadRecord> {
  const response = await axios.post(
    `${API_BASE_URL}/leads/admin/${id}/call`,
    payload,
    { headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } },
  );
  return response.data.lead;
}
