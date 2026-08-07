"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

const STATES_CACHE_KEY = "mandiplus:reference:states";
const COMMODITIES_CACHE_KEY = "mandiplus:reference:commodities";

export type ReferenceStateOption = {
  value: string;
  label: string;
};

export type ReferenceCommodityOption = {
  code: string;
  label: string;
  emoji: string;
  sortOrder?: number;
};

export const FALLBACK_INDIA_STATES: ReferenceStateOption[] = [
  { value: "ANDAMAN_AND_NICOBAR_ISLANDS", label: "Andaman and Nicobar Islands" },
  { value: "ANDHRA_PRADESH", label: "Andhra Pradesh" },
  { value: "ARUNACHAL_PRADESH", label: "Arunachal Pradesh" },
  { value: "ASSAM", label: "Assam" },
  { value: "BIHAR", label: "Bihar" },
  { value: "CHANDIGARH", label: "Chandigarh" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  {
    value: "DADRA_AND_NAGAR_HAVELI_AND_DAMAN_AND_DIU",
    label: "Dadra and Nagar Haveli and Daman and Diu",
  },
  { value: "DELHI", label: "Delhi" },
  { value: "GOA", label: "Goa" },
  { value: "GUJARAT", label: "Gujarat" },
  { value: "HARYANA", label: "Haryana" },
  { value: "HIMACHAL_PRADESH", label: "Himachal Pradesh" },
  { value: "JAMMU_AND_KASHMIR", label: "Jammu and Kashmir" },
  { value: "JHARKHAND", label: "Jharkhand" },
  { value: "KARNATAKA", label: "Karnataka" },
  { value: "KERALA", label: "Kerala" },
  { value: "LADAKH", label: "Ladakh" },
  { value: "LAKSHADWEEP", label: "Lakshadweep" },
  { value: "MADHYA_PRADESH", label: "Madhya Pradesh" },
  { value: "MAHARASHTRA", label: "Maharashtra" },
  { value: "MANIPUR", label: "Manipur" },
  { value: "MEGHALAYA", label: "Meghalaya" },
  { value: "MIZORAM", label: "Mizoram" },
  { value: "NAGALAND", label: "Nagaland" },
  { value: "ODISHA", label: "Odisha" },
  { value: "PUDUCHERRY", label: "Puducherry" },
  { value: "PUNJAB", label: "Punjab" },
  { value: "RAJASTHAN", label: "Rajasthan" },
  { value: "SIKKIM", label: "Sikkim" },
  { value: "TAMIL_NADU", label: "Tamil Nadu" },
  { value: "TELANGANA", label: "Telangana" },
  { value: "TRIPURA", label: "Tripura" },
  { value: "UTTAR_PRADESH", label: "Uttar Pradesh" },
  { value: "UTTARAKHAND", label: "Uttarakhand" },
  { value: "WEST_BENGAL", label: "West Bengal" },
];

export const FALLBACK_COMMODITIES: ReferenceCommodityOption[] = [
  { code: "TENDER_COCONUT", label: "Tender Coconut", emoji: "🥥", sortOrder: 10 },
  { code: "TOMATO", label: "Tomato", emoji: "🍅", sortOrder: 20 },
  { code: "POMEGRANATE", label: "Anar", emoji: "🍎", sortOrder: 25 },
  { code: "MANGO", label: "Mango", emoji: "🥭", sortOrder: 30 },
  { code: "APPLE", label: "Apple", emoji: "🍎", sortOrder: 35 },
  { code: "BANANA", label: "Banana", emoji: "🍌", sortOrder: 40 },
  { code: "ONION", label: "Onion", emoji: "🧅", sortOrder: 50 },
  { code: "POTATO", label: "Potato", emoji: "🥔", sortOrder: 60 },
  { code: "OTHER", label: "Other", emoji: "🌾", sortOrder: 80 },
];

/** Onboarding always shows the vernacular name, even in English UI. */
function withAnarCommodityLabel(
  commodities: ReferenceCommodityOption[],
): ReferenceCommodityOption[] {
  return commodities
    .map((item) =>
      item.code === "POMEGRANATE"
        ? { ...item, label: "Anar", sortOrder: item.sortOrder ?? 25 }
        : item,
    )
    .slice()
    .sort(
      (left, right) =>
        (left.sortOrder ?? 999) - (right.sortOrder ?? 999) ||
        left.label.localeCompare(right.label),
    );
}

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode failures
  }
}

export function getCachedStates(): ReferenceStateOption[] {
  return (
    readCache<ReferenceStateOption[]>(STATES_CACHE_KEY) || FALLBACK_INDIA_STATES
  );
}

export function getCachedCommodities(): ReferenceCommodityOption[] {
  return withAnarCommodityLabel(
    readCache<ReferenceCommodityOption[]>(COMMODITIES_CACHE_KEY) ||
      FALLBACK_COMMODITIES,
  );
}

export async function refreshReferenceData() {
  const [statesRes, commoditiesRes] = await Promise.all([
    fetch(`${API_BASE_URL}/reference/states`).then((res) => {
      if (!res.ok) throw new Error(`states ${res.status}`);
      return res.json();
    }),
    fetch(`${API_BASE_URL}/reference/commodities`).then((res) => {
      if (!res.ok) throw new Error(`commodities ${res.status}`);
      return res.json();
    }),
  ]);

  if (Array.isArray(statesRes?.states) && statesRes.states.length) {
    writeCache(STATES_CACHE_KEY, statesRes.states);
  }
  if (
    Array.isArray(commoditiesRes?.commodities) &&
    commoditiesRes.commodities.length
  ) {
    writeCache(
      COMMODITIES_CACHE_KEY,
      withAnarCommodityLabel(commoditiesRes.commodities),
    );
  }

  return {
    states: getCachedStates(),
    commodities: getCachedCommodities(),
  };
}

export function useReferenceStates() {
  const [states, setStates] = useState<ReferenceStateOption[]>(getCachedStates);
  useEffect(() => {
    void refreshReferenceData()
      .then((data) => setStates(data.states))
      .catch(() => setStates(getCachedStates()));
  }, []);
  return states;
}

export function useReferenceCommodities() {
  const [commodities, setCommodities] =
    useState<ReferenceCommodityOption[]>(getCachedCommodities);
  useEffect(() => {
    void refreshReferenceData()
      .then((data) => setCommodities(data.commodities))
      .catch(() => setCommodities(getCachedCommodities()));
  }, []);
  return commodities;
}
