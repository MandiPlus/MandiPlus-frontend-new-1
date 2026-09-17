import type { ReferenceStateOption } from "@/features/reference";

/** Commodity → suggested trade states (pinned / chip suggestions). */
export const STATES_BY_COMMODITY: Record<string, readonly string[]> = {
  TENDER_COCONUT: ["DELHI", "KARNATAKA", "GUJARAT"],
  TOMATO: ["KARNATAKA", "ANDHRA_PRADESH"],
  POMEGRANATE: ["MAHARASHTRA"],
  APPLE: ["JAMMU_AND_KASHMIR", "HIMACHAL_PRADESH"],
  PINEAPPLE: ["DELHI", "KERALA", "WEST_BENGAL", "ASSAM"],
};

/**
 * State → suggested mandi chips (never auto-written into the field).
 * First entry is the historical primary suggestion.
 */
export const SUGGESTED_MANDIS_BY_STATE: Record<string, readonly string[]> = {
  DELHI: ["Azadpur Mandi"],
  KARNATAKA: ["Kolar", "Chamrajnagar"],
  MAHARASHTRA: ["Indapur", "Solapur"],
  ANDHRA_PRADESH: ["Anantapur"],
  JAMMU_AND_KASHMIR: ["Sopore"],
  HIMACHAL_PRADESH: ["Shimla"],
  KERALA: ["Vazhakulam", "Muvattupuzha"],
  WEST_BENGAL: ["Siliguri", "Jalpaiguri"],
  ASSAM: ["Guwahati"],
};

/** @deprecated Prefer SUGGESTED_MANDIS_BY_STATE — kept as first-chip alias. */
export const DEFAULT_MANDI_BY_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(SUGGESTED_MANDIS_BY_STATE).map(([state, mandis]) => [
    state,
    mandis[0] || "",
  ]),
);

export const KNOWN_DEFAULT_MANDIS: readonly string[] = [
  ...new Set(Object.values(SUGGESTED_MANDIS_BY_STATE).flat()),
];

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
 * Uses every mapped commodity; ignores OTHER and unmapped codes so chips still
 * appear. Empty only when nothing maps.
 */
export function suggestedStateCodesForCommodities(
  codes: readonly string[],
): string[] {
  const constraining = codes
    .map(normalizeCommodityCode)
    .filter((code) => code && code !== "OTHER");

  if (!constraining.length) return [];

  const mapped = constraining.filter((code) => STATES_BY_COMMODITY[code]);
  if (!mapped.length) return [];

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const code of mapped) {
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

/** Chip labels for suggested states (for the field above the state picker). */
export function suggestedStateOptionsForCommodities(
  codes: readonly string[],
  allStates: readonly ReferenceStateOption[],
): ReferenceStateOption[] {
  const suggested = suggestedStateCodesForCommodities(codes);
  if (!suggested.length) return [];
  const byValue = new Map(
    allStates.map((option) => [option.value, option] as const),
  );
  return suggested
    .map((value) => byValue.get(value))
    .filter((option): option is ReferenceStateOption => Boolean(option));
}

export function suggestedMandisForState(state: unknown): string[] {
  const key = normalizeGeographyState(state);
  return [...(SUGGESTED_MANDIS_BY_STATE[key] || [])];
}

export function defaultMandiForState(state: unknown): string {
  return suggestedMandisForState(state)[0] || "";
}

/**
 * Prefill when empty OR current value is still a known smart default.
 * Never clobber a custom mandi string.
 */
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

/**
 * On state change: clear empty/known-default mandis so chips can suggest.
 * Never auto-write a smart default into the field. Keep custom text.
 */
export function nextMandiForStateChange(
  currentMandi: string,
  nextState: unknown,
): string {
  void nextState;
  const trimmed = String(currentMandi || "").trim();
  if (!trimmed || isKnownDefaultMandi(trimmed)) {
    return "";
  }
  return trimmed;
}

/** @deprecated Suggestions are chips now — never auto-select state. */
export function shouldAutoSelectSuggestedState(
  _codes: readonly string[],
): boolean {
  return false;
}

/**
 * Keep any valid India state. Never auto-select corridor state or mandi —
 * those surface as tappable suggestion chips in the UI.
 */
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
  const normalizedState = normalizeGeographyState(input.state);
  const stateAllowed =
    Boolean(normalizedState) &&
    input.allStates.some((option) => option.value === normalizedState);

  let nextState = stateAllowed ? normalizedState : "";
  let nextMandi = String(input.mandiName || "");

  if (nextState) {
    nextMandi = nextMandiForStateChange(nextMandi, nextState);
  } else if (shouldReplaceMandi(nextMandi, "")) {
    nextMandi = "";
  }

  return { state: nextState, mandiName: nextMandi, visibleStates };
}
