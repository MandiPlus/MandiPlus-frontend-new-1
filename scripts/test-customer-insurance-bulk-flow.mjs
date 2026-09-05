import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  assertUsableCustomerInvoiceExtraction,
  isExtractionAbort,
  withSingleExtractionRetry,
} = await import(
  "../src/features/customer-app/invoice-extraction-recovery.ts"
);

assert.doesNotThrow(() =>
  assertUsableCustomerInvoiceExtraction({
    draft: { vehicle_number: "AP39TX6255" },
    suggestions: {
      aiExtraction: { status: "success", documentFieldCount: 1 },
    },
  }),
);

assert.throws(() =>
  assertUsableCustomerInvoiceExtraction({
    draft: { autofill_meta: { extractionFallback: true } },
    suggestions: {
      aiExtraction: { status: "fallback", documentFieldCount: 0 },
    },
  }),
);

let attempts = 0;
const recovered = await withSingleExtractionRetry(async (attempt) => {
  attempts += 1;
  if (attempt === 1) throw new Error("temporary provider error");
  return "recovered";
});
assert.equal(recovered, "recovered");
assert.equal(attempts, 2, "A failed extraction must retry exactly once.");

attempts = 0;
await assert.rejects(
  withSingleExtractionRetry(
    async () => {
      attempts += 1;
      throw new DOMException("cancelled", "AbortError");
    },
    { shouldRetry: (error) => !isExtractionAbort(error) },
  ),
);
assert.equal(attempts, 1, "Cancelled extraction must never retry.");

const page = readFileSync(
  new URL(
    "../src/features/customer-app/CustomerCreateInsurancePage.tsx",
    import.meta.url,
  ),
  "utf8",
);
const api = readFileSync(
  new URL("../src/features/customer-app/api.ts", import.meta.url),
  "utf8",
);
const draftStorage = readFileSync(
  new URL("../src/features/customer-app/invoice-drafts.ts", import.meta.url),
  "utf8",
);

assert.match(page, /extractionGenerationRef/);
assert.match(page, /extractionTasksRef/);
assert.match(page, /withSingleExtractionRetry/);
assert.match(page, /Review & pay/);
assert.match(page, /Save Draft/);
assert.match(page, /Back to overview/);
assert.match(
  page,
  /paymentDrafts\.some\(\(item\) => isPomegranateProduct\(item\.product\)\)/,
  "Anar invoices must be blocked before customer invoice creation.",
);
assert.match(page, /window\.alert\("Internal server error"\)/);
assert.doesNotMatch(page, /queueDocumentExtraction\(nextFiles\)/);
assert.match(api, /signal\?: AbortSignal/);
assert.match(draftStorage, /indexedDB\.open/);

console.log("Customer insurance bulk-flow checks passed.");
