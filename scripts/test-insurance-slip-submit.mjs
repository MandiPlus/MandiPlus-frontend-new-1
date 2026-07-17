import assert from "node:assert/strict";
import {
  formatInsuranceInvoiceMode,
  normalizeInsuranceInvoiceMode,
  resolveInsuranceInvoiceModeForSubmit,
} from "../src/features/insurance/insuranceModeSubmit.ts";
import { resolveWeighmentSlipForSubmit } from "../src/features/insurance/weighmentSlipSubmit.ts";

const stateFile = { name: "state-slip.jpg" };
const refFile = { name: "ref-slip.jpg" };
const argumentFile = { name: "argument-slip.jpg" };

assert.equal(
  resolveWeighmentSlipForSubmit(null, { current: null }, stateFile),
  stateFile,
  "falls back to state file when no direct argument/ref exists",
);

assert.equal(
  resolveWeighmentSlipForSubmit(null, { current: refFile }, stateFile),
  refFile,
  "uses the current ref file before stale React state",
);

assert.equal(
  resolveWeighmentSlipForSubmit(argumentFile, { current: refFile }, stateFile),
  argumentFile,
  "uses the direct file passed from the upload confirmation click first",
);

assert.equal(
  resolveWeighmentSlipForSubmit(null, { current: null }, null),
  null,
  "returns null only when no selected slip exists",
);

assert.equal(
  normalizeInsuranceInvoiceMode(" Cash "),
  "cash",
  "normalizes cash selection",
);

assert.equal(
  normalizeInsuranceInvoiceMode("Commission"),
  "commission",
  "normalizes commission selection",
);

assert.equal(
  normalizeInsuranceInvoiceMode("Skipped"),
  "",
  "ignores unrelated optional answers",
);

assert.equal(
  resolveInsuranceInvoiceModeForSubmit("", "Cash"),
  "cash",
  "falls back to latest selected invoice mode when form state is stale",
);

assert.equal(
  resolveInsuranceInvoiceModeForSubmit("Commission", "Cash"),
  "commission",
  "uses current form mode before latest-mode fallback",
);

assert.equal(
  formatInsuranceInvoiceMode("cash"),
  "Cash",
  "formats cash mode for submit payload",
);

assert.equal(
  formatInsuranceInvoiceMode("commission"),
  "Commission",
  "formats commission mode for submit payload",
);

console.log("insurance submit resolution ok");
