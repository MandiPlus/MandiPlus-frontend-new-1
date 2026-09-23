import { canonicalizeCommodityLabel } from "@/features/customer-app/commodity-normalization";

/**
 * Insurance premium per lakh, priced per commodity. Mirrors the backend's
 * src/common/commodity-premium-rates.ts — one code per invoice catalog
 * commodity, plus OTHER, which every commodity without its own rate follows.
 * The backend is what charges, so these defaults only show while the live
 * rate card has not loaded.
 */
const CANONICAL_NAME_TO_COMMODITY = {
  "Tender Coconut": "TENDER_COCONUT",
  Kiwi: "KIWI",
  Mango: "MANGO",
  Banana: "BANANA",
  Apple: "APPLE",
  Pineapple: "PINEAPPLE",
  "Papaya (Papita)": "PAPAYA",
  "Pomegranate (Anar)": "POMEGRANATE",
  Oranges: "ORANGE",
  Kinnow: "KINNOW",
  "Guava (Amrood)": "GUAVA",
  "Muskmelon (Kastoori Tarbooj)": "MUSKMELON",
  "Watermelon (Tarbooj)": "WATERMELON",
  Pista: "PISTA",
  Tomato: "TOMATO",
  Onion: "ONION",
  Potato: "POTATO",
  "Ginger (Fresh)": "GINGER",
  "Sweet Potato": "SWEET_POTATO",
  "Mosambi (Sweet Lime)": "MOSAMBI",
  Grapes: "GRAPES",
  "Dragon Fruit": "DRAGON_FRUIT",
  Peaches: "PEACHES",
  Plum: "PLUM",
} as const;

export type PremiumRateCommodity =
  | (typeof CANONICAL_NAME_TO_COMMODITY)[keyof typeof CANONICAL_NAME_TO_COMMODITY]
  | "OTHER";

export const PREMIUM_RATE_COMMODITIES: readonly PremiumRateCommodity[] = [
  ...Object.values(CANONICAL_NAME_TO_COMMODITY),
  "OTHER",
];

export type CommodityPremiumRates = Record<PremiumRateCommodity, number>;

export type CommodityPremiumOverrides = Partial<
  Record<PremiumRateCommodity, number>
>;

export type CommodityPremiumRatesConfig = {
  /** The effective rate for every commodity. */
  rates: CommodityPremiumRates;
  /** Rates set for a specific commodity; the rest follow OTHER. Optional on an older backend. */
  explicit?: CommodityPremiumOverrides;
  /** Every commodity the backend can price, in display order. */
  commodities?: Array<{ code: string; label: string }>;
  isDefault: boolean;
  updatedAt: string | null;
};

const DEFAULT_EXPLICIT_PREMIUM_RATES: CommodityPremiumOverrides = {
  TOMATO: 399,
  POMEGRANATE: 250,
  PINEAPPLE: 250,
  TENDER_COCONUT: 200,
  OTHER: 250,
};

export const PREMIUM_RATE_COMMODITY_LABELS = Object.fromEntries([
  ...Object.entries(CANONICAL_NAME_TO_COMMODITY).map(([name, code]) => [
    code,
    name,
  ]),
  ["OTHER", "All other commodities"],
]) as Record<PremiumRateCommodity, string>;

export function resolvePremiumRateCommodity(
  productName: unknown,
): PremiumRateCommodity {
  return (
    CANONICAL_NAME_TO_COMMODITY[
      canonicalizeCommodityLabel(
        productName,
      ) as keyof typeof CANONICAL_NAME_TO_COMMODITY
    ] || "OTHER"
  );
}

function positiveRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
}

/**
 * The effective rate for every commodity from an effective or explicit rate
 * map; commodities without a rate follow OTHER. Nothing given → launch card.
 */
export function normalizeCommodityPremiumRates(
  value: unknown,
): CommodityPremiumRates {
  const explicit =
    value && typeof value === "object"
      ? normalizeCommodityPremiumOverrides(value)
      : { ...DEFAULT_EXPLICIT_PREMIUM_RATES };
  const other = explicit.OTHER ?? (DEFAULT_EXPLICIT_PREMIUM_RATES.OTHER as number);
  return PREMIUM_RATE_COMMODITIES.reduce((rates, commodity) => {
    rates[commodity] = explicit[commodity] ?? other;
    return rates;
  }, {} as CommodityPremiumRates);
}

export const DEFAULT_COMMODITY_PREMIUM_RATES: CommodityPremiumRates =
  normalizeCommodityPremiumRates(undefined);

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
