import assert from "node:assert/strict";
import test from "node:test";

import {
  currentWalletPackCatalogVersion,
  fallbackWalletPacks,
  reconcileWalletCreditPacks,
} from "./wallet-catalog.ts";

test("keeps the complete current server catalog in display order", () => {
  const serverPacks = fallbackWalletPacks.map((pack, index) => ({
    ...pack,
    id: `server-pack-${index + 1}`,
  }));

  const result = reconcileWalletCreditPacks(
    serverPacks,
    currentWalletPackCatalogVersion,
  );

  assert.deepEqual(
    result.map((pack) => pack.code),
    [
      "limit_50_lakh",
      "limit_1_cr",
      "limit_2_cr",
      "limit_4_cr",
      "limit_6_cr",
      "limit_8_cr",
      "limit_10_cr",
    ],
  );
  assert.equal(result[6]?.creditAmount, 100_000_000);
});

test("fills legacy partial catalogs without dropping the newer packs", () => {
  const result = reconcileWalletCreditPacks(
    [
      {
        ...fallbackWalletPacks[1],
        id: "server-one-crore",
        priceAmount: 19_500,
      },
    ],
    1,
  );

  assert.equal(result.length, 7);
  assert.equal(
    result.find((pack) => pack.code === "limit_1_cr")?.id,
    "server-one-crore",
  );
  assert.equal(
    result.find((pack) => pack.code === "limit_1_cr")?.priceAmount,
    19_500,
  );
  assert.ok(result.some((pack) => pack.code === "limit_10_cr"));
});

test("filters inactive or invalid entries from a current catalog", () => {
  const result = reconcileWalletCreditPacks(
    [
      { ...fallbackWalletPacks[0], isActive: false },
      { ...fallbackWalletPacks[1], priceAmount: 0 },
      { ...fallbackWalletPacks[2], id: "valid-pack" },
    ],
    currentWalletPackCatalogVersion,
  );

  assert.deepEqual(result.map((pack) => pack.id), ["valid-pack"]);
});
