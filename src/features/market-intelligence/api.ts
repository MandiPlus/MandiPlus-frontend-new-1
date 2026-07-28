'use client';

import axios from 'axios';
import {
  MarketObservationRow,
  MarketLiveRadar,
  MarketNarrative,
  MarketPulseQuery,
  MarketPulseResponse,
  MarketSourcePlan,
  MarketSourcePreviewRow,
  MarketSourceRunRow,
  MarketSourceRow,
  MarketWriteStatus,
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function getAdminHeaders() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getMarketPulse(
  query: MarketPulseQuery,
): Promise<MarketPulseResponse> {
  const response = await axios.get<MarketPulseResponse>(
    `${API_BASE_URL}/admin/market-intelligence/pulse`,
    {
      headers: getAdminHeaders(),
      params: query,
    },
  );
  return response.data;
}

export async function generateMarketNarrative(
  query: MarketPulseQuery,
): Promise<{
  success: boolean;
  data?: MarketNarrative;
  message?: string;
}> {
  const response = await axios.post(
    `${API_BASE_URL}/admin/market-intelligence/narrative`,
    query,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getMarketLiveRadar(
  query: MarketPulseQuery,
): Promise<{
  success: boolean;
  data?: MarketLiveRadar;
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/live-radar`,
    {
      headers: getAdminHeaders(),
      params: query,
    },
  );
  return response.data;
}

export async function getMarketSources(): Promise<{
  success: boolean;
  data?: MarketSourceRow[];
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/sources`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getMarketSourceRuns(): Promise<{
  success: boolean;
  data?: MarketSourceRunRow[];
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/source-runs`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getMarketSourcePreviews(
  limit = 6,
  options?: {
    offset?: number;
    filters?: Record<string, string>;
  },
): Promise<{
  success: boolean;
  data?: MarketSourcePreviewRow[];
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/source-previews`,
    {
      headers: getAdminHeaders(),
      params: {
        limit,
        offset: options?.offset,
        ...(options?.filters || {}),
      },
    },
  );
  return response.data;
}

export async function getMarketSourcePlan(): Promise<{
  success: boolean;
  data?: MarketSourcePlan;
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/source-plan`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getMarketWriteStatus(): Promise<{
  success: boolean;
  data?: MarketWriteStatus;
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/write-status`,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function seedMarketSources(): Promise<{
  success: boolean;
  data?: MarketSourceRow;
  message?: string;
}> {
  const response = await axios.post(
    `${API_BASE_URL}/admin/market-intelligence/sources/seed-defaults`,
    {},
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function runMarketSource(
  sourceId: string,
  options: {
    limit?: number;
    offset?: number;
    filters?: Record<string, string>;
  } = {},
): Promise<{
  success: boolean;
  data?: unknown;
  message?: string;
}> {
  const response = await axios.post(
    `${API_BASE_URL}/admin/market-intelligence/sources/${sourceId}/run`,
    options,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function captureFieldFeedback(payload: {
  commodity?: string;
  state?: string;
  market?: string;
  actorName?: string;
  actorRole?: string;
  feedbackType: string;
  text: string;
  confidence?: number;
}): Promise<{
  success: boolean;
  data?: unknown;
  message?: string;
}> {
  const response = await axios.post(
    `${API_BASE_URL}/admin/market-intelligence/field-feedback`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
}

export async function getMarketObservations(params?: {
  sourceId?: string;
  commodity?: string;
  state?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: MarketObservationRow[];
  message?: string;
}> {
  const response = await axios.get(
    `${API_BASE_URL}/admin/market-intelligence/observations`,
    {
      headers: getAdminHeaders(),
      params,
    },
  );
  return response.data;
}
