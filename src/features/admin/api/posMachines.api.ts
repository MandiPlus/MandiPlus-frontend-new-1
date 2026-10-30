'use client';

import axios, { AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export type MachineStatus = 'stock' | 'given' | 'repair' | 'lost';
export type PayMode = 'cash' | 'upi' | 'bank' | 'other';

export interface PosMachine {
  id: string;
  serial: string;
  model: string;
  tid: string;
  status: MachineStatus;
  note: string;
  userId: string | null;
  name: string;
  phone: string;
  givenOn: string | null;
  pricePaise: number;
  paidPaise: number;
  duePaise: number;
  lastPaidOn: string | null;
  holdingNo: number;
  updatedAt: string;
}

export interface PosMachineTotals {
  count: number;
  given: number;
  stock: number;
  away: number;
  pricePaise: number;
  paidPaise: number;
  duePaise: number;
}

export interface PosMachineEvent {
  id: string;
  action: string;
  name: string;
  phone: string;
  onDay: string;
  amountPaise: number;
  note: string;
  by: string;
  at: string;
}

export interface PosMachinePayment {
  id: string;
  holdingNo: number;
  name: string;
  amountPaise: number;
  mode: PayMode;
  paidOn: string;
  note: string;
  by: string;
  voidedAt: string | null;
  current: boolean;
}

export interface CustomerHit {
  id: string;
  name: string;
  phone: string;
}

const client = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return axios.create({
    baseURL: `${API_BASE_URL}/admin/pos-machines`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

/** The server's message, so a sheet can show "WPHK… is already in the register" as it is. */
export const errorText = (e: unknown) => {
  const data = (e as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
  return msg || (e as Error)?.message || 'Something went wrong';
};

export const posMachinesApi = {
  list: async () => (await client().get<{ machines: PosMachine[]; totals: PosMachineTotals }>('')).data,
  detail: async (id: string) =>
    (await client().get<{ machine: PosMachine; events: PosMachineEvent[]; payments: PosMachinePayment[] }>(`/${id}`)).data,
  customers: async (q: string) => (await client().get<CustomerHit[]>('/customers', { params: { q } })).data,
  add: async (body: { serial: string; model: string; tid: string; note?: string }) =>
    (await client().post<{ id: string }>('', body)).data,
  edit: async (id: string, body: { serial?: string; model?: string; tid?: string; note?: string; pricePaise?: number }) =>
    (await client().patch<{ id: string }>(`/${id}`, body)).data,
  give: async (id: string, body: { userId: string | null; name: string; phone: string; givenOn: string; pricePaise: number; note?: string }) =>
    (await client().post(`/${id}/give`, body)).data,
  back: async (id: string, body: { status: 'stock' | 'repair' | 'lost'; onDay: string; note?: string }) =>
    (await client().post(`/${id}/back`, body)).data,
  pay: async (id: string, body: { amountPaise: number; mode: PayMode; paidOn: string; note?: string }) =>
    (await client().post(`/${id}/payments`, body)).data,
  voidPayment: async (id: string, paymentId: string) => (await client().delete(`/${id}/payments/${paymentId}`)).data,
};
