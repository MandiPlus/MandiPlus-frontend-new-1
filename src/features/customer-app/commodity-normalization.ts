type CommodityDefinition = {
  name: string;
  aliases: readonly string[];
};

const COMMODITIES: readonly CommodityDefinition[] = [
  { name: "Tender Coconut", aliases: ["coconut", "green coconut", "nariyal"] },
  { name: "Kiwi", aliases: [] },
  { name: "Mango", aliases: ["aam"] },
  { name: "Banana", aliases: ["kela"] },
  { name: "Apple", aliases: ["seb", "sebb"] },
  { name: "Pineapple", aliases: ["ananas", "anannas", "anaras"] },
  { name: "Papaya (Papita)", aliases: ["papaya", "papita"] },
  { name: "Pomegranate (Anar)", aliases: ["pomegranate", "anar", "dalimb", "dalimba", "daalimb"] },
  { name: "Oranges", aliases: ["orange"] },
  { name: "Kinnow", aliases: ["kinno", "kinnu"] },
  { name: "Guava (Amrood)", aliases: ["guava", "amrood"] },
  {
    name: "Muskmelon (Kastoori Tarbooj)",
    aliases: ["muskmelon", "kastoori tarbooj"],
  },
  { name: "Watermelon (Tarbooj)", aliases: ["watermelon", "tarbooj"] },
  { name: "Pista", aliases: ["pistachio"] },
  { name: "Tomato", aliases: ["tamatar"] },
  { name: "Onion", aliases: ["pyaz", "pyaaz"] },
  { name: "Potato", aliases: ["aloo"] },
  { name: "Ginger (Fresh)", aliases: ["ginger", "fresh ginger", "adrak"] },
  { name: "Sweet Potato", aliases: ["shakarkand"] },
  { name: "Mosambi (Sweet Lime)", aliases: ["mosambi", "sweet lime"] },
  { name: "Grapes", aliases: ["grape", "angoor"] },
];

function normalizeLookup(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    // OCR splits "PINE APPLE" — fold it back before matching Apple.
    .replace(/\bpine apple\b/g, "pineapple")
    .trim();
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

function editDistance(left: string, right: string): number {
  let previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] +
          (left[leftIndex] === right[rightIndex] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function allowedDistance(length: number): number {
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return Math.min(4, Math.ceil(length * 0.22));
}

export function canonicalizeCommodityLabel(value: unknown): string {
  const original = String(value ?? "").trim();
  const wanted = normalizeLookup(original);
  if (!wanted) return "";

  const candidates = COMMODITIES.flatMap((commodity) =>
    [commodity.name, ...commodity.aliases].map((candidate) => ({
      commodity,
      candidate: normalizeLookup(candidate),
    })),
  );
  const exact = candidates.find(({ candidate }) => candidate === wanted);
  if (exact) return exact.commodity.name;

  const contained = candidates
    .filter(({ candidate }) => {
      // "pineapple" contains "apple" — keep the two from swallowing each other.
      if (candidate === "apple" && wanted.includes("pineapple")) return false;
      if (candidate === "pineapple" && !wanted.includes("pineapple")) {
        return false;
      }
      return (
        candidate.length >= 4 &&
        (wanted.includes(candidate) || candidate.includes(wanted))
      );
    })
    .sort((left, right) => right.candidate.length - left.candidate.length)[0];
  if (contained) return contained.commodity.name;

  const compactWanted = compact(wanted);
  if (compactWanted.length < 4) return original;
  const fuzzy = candidates
    .map(({ commodity, candidate }) => {
      const compactCandidate = compact(candidate);
      const distance = editDistance(compactWanted, compactCandidate);
      return {
        commodity,
        candidateLength: compactCandidate.length,
        comparisonLength: Math.max(
          compactWanted.length,
          compactCandidate.length,
        ),
        distance,
      };
    })
    .filter(
      ({ distance, comparisonLength }) =>
        distance <= allowedDistance(comparisonLength) &&
        distance / comparisonLength <= 0.26,
    )
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.candidateLength - left.candidateLength,
    )[0];

  return fuzzy?.commodity.name || original;
}
