export const INDIAN_STATE_OPTIONS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export type MandiLocationInput = {
  state?: string | null;
  district?: string | null;
  mandi?: string | null;
};

export type MandiLocationValue = {
  state: string;
  district: string;
  mandi: string;
};

const cleanPart = (value?: string | null) => String(value || "").trim();
const normalizeComparable = (value?: string | null) =>
  cleanPart(value).replace(/_/g, " ").toLowerCase();
const MARKET_HINT_PATTERN =
  /\b(mandi|market|yard|apmc|sabzi|fruit|veg|vegetable|bazaar)\b/i;
const COUNTRY_PATTERN = /\b(india|bharat)\b/gi;
const PIN_CODE_PATTERN = /\b\d{5,6}\b/g;
const KNOWN_DISTRICT_ALIASES: Record<string, Record<string, string>> = {
  KARNATAKA: {
    mandya: "Mandya",
    maddur: "Mandya",
    kikkeri: "Mandya",
    kikeri: "Mandya",
    pandavapura: "Mandya",
    pandavpura: "Mandya",
    channarayapatna: "Hassan",
    channarayapatra: "Hassan",
    shravanabelagola: "Hassan",
    shravanbelagola: "Hassan",
    bannur: "Mysuru",
    mysore: "Mysuru",
    mysuru: "Mysuru",
    sirsi: "Uttara Kannada",
    srinivaspur: "Kolar",
    chintamani: "Chikkaballapur",
    kolar: "Kolar",
  },
  ANDHRA_PRADESH: {
    madanapalle: "Annamayya",
    madanpalle: "Annamayya",
    "v kota": "Chittoor",
    venkatagirikota: "Chittoor",
    chittoor: "Chittoor",
    anantapur: "Anantapur",
  },
  PUNJAB: {
    ludhiana: "Ludhiana",
  },
  BIHAR: {
    mohaniya: "Kaimur",
  },
  WEST_BENGAL: {
    asansol: "Paschim Bardhaman",
    kolkata: "Kolkata",
  },
  HARYANA: {
    panipat: "Panipat",
  },
  MADHYA_PRADESH: {
    bhopal: "Bhopal",
  },
  DELHI: {
    azadpur: "North West Delhi",
    "azadpur mandi": "North West Delhi",
    ghazipur: "East Delhi",
    "ghazipur mandi": "East Delhi",
    okhla: "South East Delhi",
    "okhla mandi": "South East Delhi",
  },
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanLocationText = (value?: string | null) =>
  normalizeStateLabel(value)
    .replace(COUNTRY_PATTERN, " ")
    .replace(PIN_CODE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,|/-])/g, "$1")
    .replace(/([,|/-])\s+/g, "$1")
    .replace(/^[,|/-]+|[,|/-]+$/g, "")
    .trim();

const statePatternFor = (state: string) =>
  new RegExp(`\\b${escapeRegExp(state).replace(/\s+/g, "\\s+")}\\b`, "i");

const findStateMatch = (value?: string | null) => {
  const text = cleanLocationText(value);
  if (!text) {
    return null;
  }

  const exact = INDIAN_STATE_OPTIONS.find(
    (state) => normalizeComparable(state) === normalizeComparable(text),
  );
  if (exact) {
    return {
      state: exact,
      index: 0,
      length: text.length,
      matchedText: text,
    };
  }

  const sortedStates = [...INDIAN_STATE_OPTIONS].sort(
    (a, b) => b.length - a.length,
  );
  for (const state of sortedStates) {
    const match = text.match(statePatternFor(state));
    if (match && typeof match.index === "number") {
      return {
        state,
        index: match.index,
        length: match[0].length,
        matchedText: match[0],
      };
    }
  }

  return null;
};

const splitLocationParts = (value?: string | null) =>
  cleanLocationText(value)
    .split(/\r?\n|,|\||\//)
    .map(cleanLocationText)
    .filter(Boolean);

const removeStateFromText = (value: string, state: string) =>
  cleanLocationText(value.replace(statePatternFor(state), " "));

const resolveKnownDistrict = (
  state?: string | null,
  ...values: Array<string | null | undefined>
) => {
  const stateMatch = findStateMatch(state);
  const aliases = stateMatch
    ? KNOWN_DISTRICT_ALIASES[
        stateMatch.state.toUpperCase().replace(/\s+/g, "_")
      ]
    : undefined;
  if (!aliases) {
    return "";
  }

  const haystack = normalizeComparable(values.filter(Boolean).join(" "));
  const sortedAliases = Object.keys(aliases).sort(
    (a, b) => b.length - a.length,
  );
  const matchedAlias = sortedAliases.find((alias) =>
    new RegExp(
      `\\b${escapeRegExp(alias).replace(/\s+/g, "\\s+")}\\b`,
      "i",
    ).test(haystack),
  );
  return matchedAlias ? aliases[matchedAlias] : "";
};

export const buildMandiLocationLine = ({
  state,
  district,
  mandi,
}: MandiLocationInput) =>
  [mandi, district, state].map(cleanPart).filter(Boolean).join(", ");

export const normalizeStateLabel = (value?: string | null) =>
  cleanPart(value).replace(/_/g, " ");

export const inferMandiLocationFromText = (
  text?: string | null,
  fallback?: MandiLocationInput,
): MandiLocationValue => {
  const textStateMatch = findStateMatch(text);
  const fallbackStateMatch = findStateMatch(fallback?.state);
  const fallbackState = fallbackStateMatch?.state || "";
  const fallbackDistrict = cleanPart(fallback?.district);
  const fallbackMandi = cleanPart(fallback?.mandi);
  const cleanedText = cleanLocationText(text);
  const parts = splitLocationParts(cleanedText);
  const lastPart = parts[parts.length - 1] || "";
  const lastPartStateMatch = findStateMatch(lastPart);
  const lastPartIsState =
    Boolean(lastPartStateMatch) &&
    normalizeComparable(lastPartStateMatch?.state) ===
      normalizeComparable(lastPart);
  const state =
    textStateMatch?.state ||
    (lastPartIsState ? lastPartStateMatch?.state || "" : "") ||
    fallbackState ||
    "";
  const bodyParts = (lastPartIsState ? parts.slice(0, -1) : parts)
    .map((part) => (state ? removeStateFromText(part, state) : part))
    .map(cleanLocationText)
    .filter(Boolean);

  let district = fallbackDistrict;
  let mandi = fallbackMandi;

  if (!district && parts.length <= 1 && state && textStateMatch) {
    const beforeState = cleanLocationText(
      cleanedText.slice(0, textStateMatch.index),
    );
    const afterState = cleanLocationText(
      cleanedText.slice(textStateMatch.index + textStateMatch.length),
    );
    const localHint = beforeState || afterState;
    if (localHint) {
      if (MARKET_HINT_PATTERN.test(localHint)) {
        mandi = mandi || localHint;
      } else {
        district = localHint;
      }
    }
  }

  if (!district && bodyParts.length >= 2) {
    district = bodyParts[bodyParts.length - 1];
  }

  if (!mandi && bodyParts.length >= 2) {
    mandi = bodyParts.slice(0, -1).join(", ");
  }

  if (
    !mandi &&
    bodyParts.length === 1 &&
    MARKET_HINT_PATTERN.test(bodyParts[0])
  ) {
    mandi = bodyParts[0];
  }

  if (!district && bodyParts.length === 1 && !mandi) {
    district = bodyParts[0];
  }

  if (
    district &&
    state &&
    normalizeComparable(district) === normalizeComparable(state)
  ) {
    district = "";
  }
  if (
    mandi &&
    state &&
    normalizeComparable(mandi) === normalizeComparable(state)
  ) {
    mandi = "";
  }
  if (
    mandi &&
    district &&
    normalizeComparable(mandi) === normalizeComparable(district)
  ) {
    mandi = MARKET_HINT_PATTERN.test(mandi) ? mandi : "";
  }

  return {
    state: cleanPart(state),
    district: cleanLocationText(
      resolveKnownDistrict(state, cleanedText, district, mandi) || district,
    ),
    mandi: cleanLocationText(mandi),
  };
};
