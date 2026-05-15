'use client';

import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function getAdminHeaders() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type PipelineShipmentStatus = 'active' | 'completed' | 'on_hold';
export type PipelineStageStatus = 'pending' | 'in_progress' | 'done';

export interface PipelineDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export interface PipelineStage {
  id: string;
  shipmentId: string;
  stageNumber: number;
  status: PipelineStageStatus;
  updatedAt?: string | null;
  updatedBy?: string | null;
  data?: Record<string, any> | null;
  notes?: string | null;
  documents: PipelineDocument[];
}

export interface PipelineShipmentSummary {
  id: string;
  displayId: string;
  createdAt: string;
  currentStage: number;
  status: PipelineShipmentStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  origin: string;
  destination: string;
  lastUpdated: string;
}

export interface PipelineShipmentDetail {
  id: string;
  displayId?: string;
  createdAt: string;
  currentStage: number;
  status: PipelineShipmentStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  origin: string;
  destination: string;
  stages: PipelineStage[];
}

export interface PipelineAuditEntry {
  id: string;
  shipmentId: string;
  stageNumber: number;
  changedBy?: string | null;
  changedAt: string;
  previousData?: Record<string, any> | null;
  updatedData?: Record<string, any> | null;
}

export interface PipelineShipmentListResponse {
  data: PipelineShipmentSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateShipmentPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  origin: string;
  destination: string;
}

export interface UpdatePipelineStagePayload {
  status?: PipelineStageStatus;
  notes?: string;
  data?: Record<string, any>;
  updatedBy?: string;
}

function withApiBase(path: string) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

export function getPipelineDocumentUrl(fileUrl: string) {
  return withApiBase(fileUrl);
}

export async function getPipelineShipments(params?: {
  status?: PipelineShipmentStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const response = await axios.get<PipelineShipmentListResponse>(
    `${API_BASE_URL}/pipeline/shipments`,
    {
      headers: getAdminHeaders(),
      params,
    },
  );
  return response.data;
}

export async function createPipelineShipment(payload: CreateShipmentPayload) {
  const response = await axios.post<PipelineShipmentDetail>(
    `${API_BASE_URL}/pipeline/shipments`,
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

export async function getPipelineShipment(id: string) {
  const response = await axios.get<PipelineShipmentDetail>(
    `${API_BASE_URL}/pipeline/shipments/${id}`,
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
}

export async function updatePipelineStage(
  shipmentId: string,
  stageNumber: number,
  payload: UpdatePipelineStagePayload,
) {
  const response = await axios.patch<PipelineShipmentDetail>(
    `${API_BASE_URL}/pipeline/shipments/${shipmentId}/stage/${stageNumber}`,
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

export async function uploadPipelineDocument(
  shipmentId: string,
  stageNumber: number,
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post<PipelineDocument>(
    `${API_BASE_URL}/pipeline/shipments/${shipmentId}/stage/${stageNumber}/documents`,
    formData,
    {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data;
}

export async function deletePipelineDocument(docId: string) {
  const response = await axios.delete(`${API_BASE_URL}/pipeline/documents/${docId}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
}

export async function getPipelineAuditTrail(shipmentId: string) {
  const response = await axios.get<PipelineAuditEntry[]>(
    `${API_BASE_URL}/pipeline/shipments/${shipmentId}/audit`,
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
}
