import { canonicalizeCommodityLabel } from "@/features/customer-app/commodity-normalization";

/**
 * Insurance premium per lakh, priced per commodity. Mirrors the backend's
 * src/common/commodity-premium-rates.ts: the backend is what charges, so these
 * defaults only show while the live rate card has not loaded.
 */
export const PREMIUM_RATE_COMMODITIES = [
  "TOMATO",
  "POMEGRANATE",
  "PINEAPPLE",
  "TENDER_COCONUT",
  "OTHER",
] as const;

export type PremiumRateCommodity = (typeof PREMIUM_RATE_COMMODITIES)[number];

export type CommodityPremiumRates = Record<PremiumRateCommodity, number>;

export type CommodityPremiumOverrides = Partial<
  Record<PremiumRateCommodity, number>
>;

export type CommodityPremiumRatesConfig = {
  rates: CommodityPremiumRates;
  isDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_COMMODITY_PREMIUM_RATES: CommodityPremiumRates = {
  TOMATO: 399,
  POMEGRANATE: 250,
  PINEAPPLE: 250,
  TENDER_COCONUT: 200,
  OTHER: 250,
};

export const PREMIUM_RATE_COMMODITY_LABELS: Record<
  PremiumRateCommodity,
  string
> = {
  TOMATO: "Tomato",
  POMEGRANATE: "Pomegranate",
  PINEAPPLE: "Pineapple",
  TENDER_COCONUT: "Tender Coconut",
  OTHER: "All other commodities",
};

const CANONICAL_NAME_TO_COMMODITY: Record<string, PremiumRateCommodity> = {
  Tomato: "TOMATO",
  "Pomegranate (Anar)": "POMEGRANATE",
  Pineapple: "PINEAPPLE",
  "Tender Coconut": "TENDER_COCONUT",
};

export function resolvePremiumRateCommodity(
  productName: unknown,
): PremiumRateCommodity {
  return (
    CANONICAL_NAME_TO_COMMODITY[canonicalizeCommodityLabel(productName)] ||
    "OTHER"
  );
}

function positiveRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
}

export function normalizeCommodityPremiumRates(
  value: unknown,
): CommodityPremiumRates {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return PREMIUM_RATE_COMMODITIES.reduce((rates, commodity) => {
    rates[commodity] =
      positiveRate(source[commodity]) ??
      DEFAULT_COMMODITY_PREMIUM_RATES[commodity];
    return rates;
  }, {} as CommodityPremiumRates);
}

export function normalizeCommodityPremiumOverrides(
  value: unknown,
): CommodityPremiumOverrides {
  if (!value || typeof value !== "object") return {};
  const overrides: CommodityPremiumOverrides = {};
  for (const commodity of PREMIUM_RATE_COMMODITIES) {
    const rate = positiveRate((value as Record<string, unknown>)[commodity]);
    if (rate !== null) overrides[commodity] = rate;
  }
  return overrides;
}

/** The customer's rate for this commodity, else the rate card's. */
export function resolveCommodityPremiumPerLakh(input: {
  productName: unknown;
  rates?: unknown;
  overrides?: unknown;
}): number {
  const commodity = resolvePremiumRateCommodity(input.productName);
  return (
    normalizeCommodityPremiumOverrides(input.overrides)[commodity] ??
    normalizeCommodityPremiumRates(input.rates)[commodity]
  );
}
