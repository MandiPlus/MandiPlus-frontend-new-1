'use client';

import axios from 'axios';
import { getStoredAuthToken } from '@/features/auth/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export type FieldRole = 'SURVEY_AGENT' | 'MEETING_TEAM';

export type LeadStatus =
  | 'new_lead'
  | 'contact_pending'
  | 'contacted'
  | 'appointment_scheduled'
  | 'meeting_assigned'
  | 'meeting_completed'
  | 'converted'
  | 'not_interested'
  | 'follow_up_required'
  | 'closed';

export type MeetingInterestLevel = 'hot' | 'warm' | 'cold';

export interface FieldProfile {
  user: {
    id: string;
    name: string;
    mobileNumber: string;
    state: string;
    identity: string | null;
  };
  role: FieldRole;
  accessPending: boolean;
  isActive: boolean;
}

export interface FieldLead {
  id: string;
  businessName: string;
  customerName: string;
  businessAddress: string;
  mobileNumber: string;
  businessType: string;
  boardPhotoUrl?: string | null;
  currentStatus: LeadStatus;
  latestFeedbackSummary?: string | null;
  createdAt: string;
  createdByUser?: {
    name?: string;
  };
}

export interface FieldAppointment {
  id: string;
  scheduledAt: string;
  notes?: string | null;
  status: 'scheduled' | 'completed' | 'rescheduled' | 'cancelled';
  lead: FieldLead;
  assignedMeetingUser?: {
    id: string;
    name: string;
  } | null;
}

export interface FieldDashboardResponse {
  profile: FieldProfile;
  stats: {
    myLeads: number;
    openLeads: number;
    upcomingMeetings: number;
    completedMeetings: number;
  };
  recentLeads: FieldLead[];
}

function getAuthHeaders() {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getFieldProfile(): Promise<FieldProfile> {
  const response = await axios.get(`${API_BASE_URL}/field-operations/profile`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getFieldDashboard(): Promise<FieldDashboardResponse> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/dashboard`,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function createFieldLead(payload: FormData): Promise<FieldLead> {
  const response = await axios.post(
    `${API_BASE_URL}/field-operations/leads`,
    payload,
    {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data;
}

export async function getMyFieldLeads(): Promise<FieldLead[]> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/leads/my`,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function getMyFieldMeetings(): Promise<FieldAppointment[]> {
  const response = await axios.get(
    `${API_BASE_URL}/field-operations/meetings/my`,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function submitMeetingFeedback(
  appointmentId: string,
  payload: {
    customerResponse?: string;
    interestLevel?: MeetingInterestLevel;
    notes?: string;
    nextAction?: string;
    followUpDate?: string;
    outcomeStatus: LeadStatus;
  },
) {
  const response = await axios.post(
    `${API_BASE_URL}/field-operations/appointments/${appointmentId}/feedback`,
    payload,
    {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    },
  );
  return response.data;
}

