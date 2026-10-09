/**
 * Free-text crop name → commodity code, for the customer web app.
 *
 * Mirrors the backend's src/common/commodity-matching.ts. The backend is what
 * persists the code; this exists so the setup modal and the profile page agree
 * with it while the user is still typing, and so neither has to keep its own
 * half-list of crops.
 *
 * Order matters: the first pattern that hits wins, which is how Pineapple
 * stays ahead of Apple ("pineapple" contains "apple").
 */

/** Whole-word alternation over the normalized text. */
function word(...alternatives: string[]): RegExp {
  return new RegExp(`(^| )(${alternatives.join("|")})( |$)`);
}

const COMMODITY_MATCHERS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  {
    code: "TENDER_COCONUT",
    pattern: word("tender coconut", "coconut", "green coconut", "nariyal"),
  },
  { code: "TOMATO", pattern: word("tomato(es)?", "tamatar") },
  // Pineapple before Apple — "pineapple" contains "apple".
  { code: "PINEAPPLE", pattern: word("pineapple", "anan+as", "anaras") },
  { code: "APPLE", pattern: word("apple", "seb", "sebb") },
  // Dragon Fruit before any bare "fruit" reading.
  {
    code: "DRAGON_FRUIT",
    pattern: word("dragon ?fruit", "kamalam", "pitaya", "pitahaya"),
  },
  { code: "MANGO", pattern: word("mango(es)?", "aam") },
  { code: "BANANA", pattern: word("banana(s)?", "kela") },
  { code: "KIWI", pattern: word("kiwi(s|fruit)?") },
  {
    code: "MOSAMBI",
    pattern: word("mosambi", "mousambi", "musambi", "sweet lime"),
  },
  { code: "GUAVA", pattern: word("guava(s)?", "amrood", "amrud") },
  {
    code: "PEACHES",
    pattern: word("peach(es)?", "nectarine(s)?", "aadu", "aaru"),
  },
  { code: "PLUM", pattern: word("plum(s)?", "alubukhara") },
  { code: "WATERMELON", pattern: word("watermelon(s)?", "tarbooj", "tarbuj") },
  { code: "PAPAYA", pattern: word("papaya(s)?", "papita") },
  // Kinnow and santra are sold as oranges in the mandi.
  {
    code: "ORANGE",
    pattern: word("orange(s)?", "santra", "kinnow", "kinno", "kinnu"),
  },
  {
    code: "POMEGRANATE",
    pattern: word("pomegranate(s)?", "anar", "daa?limba?"),
  },
  { code: "GRAPES", pattern: word("grapes?", "angoor", "angur") },
  { code: "ONION", pattern: word("onion(s)?", "pyaa?z") },
  { code: "POTATO", pattern: word("potato(es)?", "aloo", "alu") },
  { code: "GINGER", pattern: word("ginger", "adrak") },
];

/** Lowercase, fold punctuation to single spaces, rejoin split "PINE APPLE". */
export function normalizeCommodityLookup(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    // OCR splits "PINE APPLE" — fold it back before matching Apple.
    .replace(/\bpine apple\b/g, "pineapple")
    .trim();
}

/**
 * Resolve a crop label to a code, or "" when the text is empty.
 * Anything non-empty that no matcher claims is OTHER.
 *
 * `commodities` is the live reference list; when given, a label that matches
 * one of its entries wins, so an admin-renamed commodity resolves correctly
 * without a client release.
 */
export function commodityCodeFromLabel(
  value: unknown,
  commodities: ReadonlyArray<{ code: string; label: string }> = [],
): string {
  const normalized = normalizeCommodityLookup(value);
  if (!normalized) return "";

  const fromCatalog = commodities.find(
    (item) => normalizeCommodityLookup(item.label) === normalized,
  )?.code;
  if (fromCatalog) return fromCatalog;

  return (
    COMMODITY_MATCHERS.find(({ pattern }) => pattern.test(normalized))?.code ||
    "OTHER"
  );
}

/** Narrow an arbitrary value to a code the live reference list knows. */
export function normalizeCommodityCode(
  value: unknown,
  commodities: ReadonlyArray<{ code: string }> = [],
): string {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  if (!normalized) return "";
  if (!commodities.length) return normalized;
  return commodities.some((item) => item.code === normalized)
    ? normalized
    : "";
}
