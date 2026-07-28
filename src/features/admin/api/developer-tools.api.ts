'use client';

import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function headers() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type DeveloperTestInvoice = {
  id: string;
  invoiceNumber: string;
  mobileNumber: string;
  productName: string;
  amount: number;
  premiumAmount: number;
  isVerified: boolean;
  paymentStatus: string;
  pdfUrl: string | null;
  createdAt: string;
};

export type LiveVehicle = {
  id: string;
  vehicleNumber: string;
  status: string;
  route: string;
  sourceName: string | null;
  destinationName: string | null;
  product: string | null;
  invoiceNumber: string | null;
  updatedAt: string;
};

export type VehicleAssociation = {
  id: string;
  userId: string;
  userName: string;
  mobileNumber: string;
  vehicleNumber: string;
  expiresAt: string;
  createdAt: string;
};

export async function createDeveloperTestInvoice(mobileNumber: string) {
  const response = await axios.post<{ success: boolean; data: DeveloperTestInvoice }>(
    `${API_BASE_URL}/admin/developer-tools/test-invoices`,
    { mobileNumber },
    { headers: headers() },
  );
  return response.data.data;
}

export async function getLiveVehicles() {
  const response = await axios.get<{ success: boolean; data: LiveVehicle[] }>(
    `${API_BASE_URL}/admin/developer-tools/live-vehicles`,
    { headers: headers() },
  );
  return response.data.data;
}

export async function associateLiveVehicle(
  mobileNumber: string,
  vehicleNumber: string,
  durationHours: number,
) {
  const response = await axios.post<{ success: boolean; data: VehicleAssociation }>(
    `${API_BASE_URL}/admin/developer-tools/vehicle-associations`,
    { mobileNumber, vehicleNumber, durationHours },
    { headers: headers() },
  );
  return response.data.data;
}

export async function getVehicleAssociations(mobileNumber: string) {
  const response = await axios.get<{ success: boolean; data: VehicleAssociation[] }>(
    `${API_BASE_URL}/admin/developer-tools/vehicle-associations`,
    { headers: headers(), params: { mobileNumber } },
  );
  return response.data.data;
}

export async function removeVehicleAssociation(id: string) {
  await axios.delete(
    `${API_BASE_URL}/admin/developer-tools/vehicle-associations/${id}`,
    { headers: headers() },
  );
}
