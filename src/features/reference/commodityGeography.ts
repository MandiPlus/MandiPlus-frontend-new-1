import type { ReferenceStateOption } from "@/features/reference";

/** Commodity → suggested trade states (pinned to top of the full list). */
export const STATES_BY_COMMODITY: Record<string, readonly string[]> = {
  TENDER_COCONUT: ["DELHI", "KARNATAKA", "GUJARAT"],
  TOMATO: ["KARNATAKA", "ANDHRA_PRADESH"],
  POMEGRANATE: ["MAHARASHTRA"],
  APPLE: ["JAMMU_AND_KASHMIR", "HIMACHAL_PRADESH"],
};

/** State → suggested mandi name (user may edit). */
export const DEFAULT_MANDI_BY_STATE: Record<string, string> = {
  DELHI: "Azadpur Mandi",
  KARNATAKA: "Kolar",
  MAHARASHTRA: "Indapur",
  ANDHRA_PRADESH: "Anantapur",
  JAMMU_AND_KASHMIR: "Sopore",
  HIMACHAL_PRADESH: "Shimla",
};

export const KNOWN_DEFAULT_MANDIS: readonly string[] = Object.values(
  DEFAULT_MANDI_BY_STATE,
);

export function normalizeGeographyState(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeCommodityCode(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isKnownDefaultMandi(value: string): boolean {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return false;
  return KNOWN_DEFAULT_MANDIS.some(
    (mandi) => mandi.toLowerCase() === wanted,
  );
}

/**
 * Suggested state codes for the selected commodities (union of maps).
 * Empty when nothing mapped, or when any non-OTHER code has no map.
 */
export function suggestedStateCodesForCommodities(
  codes: readonly string[],
): string[] {
  const constraining = codes
    .map(normalizeCommodityCode)
    .filter((code) => code && code !== "OTHER");

  if (!constraining.length) return [];

  const unmapped = constraining.filter((code) => !STATES_BY_COMMODITY[code]);
  if (unmapped.length) return [];

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const code of constraining) {
    for (const state of STATES_BY_COMMODITY[code] || []) {
      if (seen.has(state)) continue;
      seen.add(state);
      ordered.push(state);
    }
  }
  return ordered;
}

/**
 * Full India state list with commodity-relevant states pinned on top.
 * Never hides other states — users can still pick any state.
 */
export function statesForCommodities(
  codes: readonly string[],
  allStates: readonly ReferenceStateOption[],
): ReferenceStateOption[] {
  const suggested = suggestedStateCodesForCommodities(codes);
  if (!suggested.length) return [...allStates];

  const byValue = new Map(
    allStates.map((option) => [option.value, option] as const),
  );
  const pinned: ReferenceStateOption[] = [];
  const pinnedValues = new Set<string>();

  for (const value of suggested) {
    const option = byValue.get(value);
    if (!option || pinnedValues.has(value)) continue;
    pinned.push(option);
    pinnedValues.add(value);
  }

  const rest = allStates.filter((option) => !pinnedValues.has(option.value));
  return [...pinned, ...rest];
}

export function defaultMandiForState(state: unknown): string {
  const key = normalizeGeographyState(state);
  return DEFAULT_MANDI_BY_STATE[key] || "";
}

export function shouldReplaceMandi(
  currentMandi: string,
  nextDefault: string,
): boolean {
  const trimmed = String(currentMandi || "").trim();
  if (!trimmed) return true;
  if (isKnownDefaultMandi(trimmed)) return true;
  void nextDefault;
  return false;
}

export function nextMandiForStateChange(
  currentMandi: string,
  nextState: unknown,
): string {
  const nextDefault = defaultMandiForState(nextState);
  if (shouldReplaceMandi(currentMandi, nextDefault)) {
    return nextDefault;
  }
  return String(currentMandi || "");
}

export function shouldAutoSelectSuggestedState(
  codes: readonly string[],
): boolean {
  return suggestedStateCodesForCommodities(codes).length === 1;
}

export function reconcileStateAndMandi(input: {
  commodityCodes: readonly string[];
  allStates: readonly ReferenceStateOption[];
  state: string;
  mandiName: string;
}): { state: string; mandiName: string; visibleStates: ReferenceStateOption[] } {
  const visibleStates = statesForCommodities(
    input.commodityCodes,
    input.allStates,
  );
  const suggested = suggestedStateCodesForCommodities(input.commodityCodes);
  const normalizedState = normalizeGeographyState(input.state);
  const stateAllowed =
    Boolean(normalizedState) &&
    input.allStates.some((option) => option.value === normalizedState);

  let nextState = stateAllowed ? normalizedState : "";
  let nextMandi = String(input.mandiName || "");

  if (!nextState && suggested.length === 1) {
    nextState = suggested[0];
  }

  if (nextState) {
    nextMandi = nextMandiForStateChange(nextMandi, nextState);
  } else if (shouldReplaceMandi(nextMandi, "")) {
    nextMandi = "";
  }

  return { state: nextState, mandiName: nextMandi, visibleStates };
}
