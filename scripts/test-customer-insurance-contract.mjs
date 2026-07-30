import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const tonnageChoices =
  page.match(
    /const TENDER_TONNAGE_CHOICES = \[(?<choices>[\s\S]*?)\] as const;/,
  )?.groups?.choices || "";

assert.match(tonnageChoices, /value: "25"/);
assert.match(tonnageChoices, /value: "30"/);
assert.doesNotMatch(tonnageChoices, /NONE|Remove/);
assert.match(page, /role="switch"/);
assert.match(page, /setLogisticsIncluded/);
assert.doesNotMatch(page, /getCustomerInvoiceProfile/);
assert.match(
  page,
  /vehicleTonnage:\s*current\.vehicleTonnage/,
  "OCR must not infer the 25/30 logistics tier from weighbridge weight.",
);
assert.match(api, /includeLogistics:\s*boolean/);
assert.match(api, /form\.append\(\s*"includeLogistics"/);

console.log("Customer insurance contract checks passed.");
