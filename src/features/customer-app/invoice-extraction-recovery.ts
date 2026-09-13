type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function unwrapExtractionPayload(response: unknown): JsonRecord {
  let payload = asRecord(response) || {};
  for (let index = 0; index < 4; index += 1) {
    if (asRecord(payload.draft)) return payload;
    const nested = asRecord(payload.data);
    if (!nested) break;
    payload = nested;
  }
  return payload;
}

/**
 * The extraction endpoint can return its known-data fallback with HTTP 200.
 * That is still a failed document read and should receive the same one-time
 * recovery as a thrown network/provider error.
 */
export function assertUsableCustomerInvoiceExtraction(response: unknown) {
  const payload = unwrapExtractionPayload(response);
  const draft = asRecord(payload.draft);
  if (!draft) throw new Error("Invoice extraction response was incomplete.");

  const suggestions = asRecord(payload.suggestions);
  const aiExtraction = asRecord(suggestions?.aiExtraction);
  const status = String(aiExtraction?.status || "").trim().toLowerCase();
  const autofillMeta = asRecord(draft.autofill_meta);

  if (autofillMeta?.extractionFallback === true || (status && status !== "success")) {
    throw new Error("Invoice document extraction did not complete.");
  }

  const rawFieldCount = aiExtraction?.documentFieldCount;
  if (rawFieldCount !== undefined && rawFieldCount !== null) {
    const fieldCount = Number(rawFieldCount);
    if (!Number.isFinite(fieldCount) || fieldCount <= 0) {
      throw new Error("Invoice details were not found.");
    }
    return;
  }

  const hasLegacyDraftValue = Object.entries(draft).some(
    ([key, value]) =>
      key !== "autofill_meta" &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "",
  );
  if (!hasLegacyDraftValue) throw new Error("Invoice details were not found.");
}

export function isExtractionAbort(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const candidate = error as { name?: unknown; code?: unknown } | null;
  return (
    candidate?.name === "CanceledError" ||
    candidate?.name === "AbortError" ||
    candidate?.code === "ERR_CANCELED"
  );
}

export async function withSingleExtractionRetry<T>(
  operation: (attempt: 1 | 2) => Promise<T>,
  options: {
    shouldRetry?: (error: unknown) => boolean;
    delayMs?: number;
  } = {},
) {
  try {
    return await operation(1);
  } catch (firstError) {
    if (options.shouldRetry && !options.shouldRetry(firstError)) {
      throw firstError;
    }
    if (Number(options.delayMs || 0) > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, options.delayMs));
    }
    if (options.shouldRetry && !options.shouldRetry(firstError)) {
      throw firstError;
    }
    return operation(2);
  }
}
