import assert from "node:assert/strict";
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

console.log("insurance slip submit resolution ok");
