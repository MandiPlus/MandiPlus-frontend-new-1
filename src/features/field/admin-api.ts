'use client';

import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function getAdminHeaders() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AdminFieldOverview {
  stats: {
    totalLeads: number;
    pendingContacts: number;
    scheduledAppointments: number;
    completedMeetings: number;
  };
  latestLeads: AdminFieldLead[];
}

export interface AdminFieldLead {
  id: string;
  businessName: string;
  customerName: string;
  businessAddress: string;
  mobileNumber: string;
  businessType?: string;
  boardPhotoUrl?: string | null;
  currentStatus: string;
  createdAt: string;
  createdByUser?: {
    name?: string;
  };
}

export interface AdminFieldAppointment {
  id: string;
  scheduledAt: string;
  status?: string;
  notes?: string | null;
  assignedMeetingUserId?: string | null;
  lead?: {
    customerName?: string;
    businessAddress?: string;
    mobileNumber?: string;
    businessName?: string;
  };
  assignedMeetingUser?: {
    name?: string;
    mobileNumber?: string;
  } | null;
}

export interface AdminFieldTeamMember {
  id: string;
  userId: string;
  role: 'SURVEY_AGENT' | 'MEETING_TEAM';
  isActive: boolean;
  user?: {
    name?: string;
    mobileNumber?: string;
  };
}

export interface AdminFieldUser {
  id: string;
  name: string;
  mobileNumber: string;
}

export async function getFieldAdminOverview(): Promise<AdminFieldOverview> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/admin/overview`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getFieldAdminLeads(): Promise<AdminFieldLead[]> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/admin/leads`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function updateFieldLeadStatus(id: string, status: string) {
  const response = await axios.patch(
    `${API_BASE_URL}/field-operations/admin/leads/${id}/status`,
    { status },
    {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

export async function getFieldAdminAppointments(): Promise<AdminFieldAppointment[]> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/admin/appointments`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function createFieldAppointment(payload: {
  leadId: string;
  assignedMeetingUserId?: string;
  scheduledAt: string;
  notes?: string;
}) {
  const response = await axios.post(
    `${API_BASE_URL}/field-operations/admin/appointments`,
    payload,
    {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

export async function sendFieldAppointmentAlert(id: string) {
  const response = await axios.post(
    `${API_BASE_URL}/field-operations/admin/appointments/${id}/send-alert`,
    {},
    {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

export async function getFieldAdminTeamMembers(): Promise<AdminFieldTeamMember[]> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/admin/team-members`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function upsertFieldAdminTeamMember(payload: {
  userId: string;
  role: 'SURVEY_AGENT' | 'MEETING_TEAM';
  isActive: boolean;
}) {
  const response = await axios.post(
    `${API_BASE_URL}/field-operations/admin/team-members`,
    payload,
    {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

export async function getUsersForFieldOperations(): Promise<AdminFieldUser[]> {
  const response = await axios.get(`${API_BASE_URL}/users`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}
