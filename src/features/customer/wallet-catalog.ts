import type { WalletCreditPack } from "./api";

export const fallbackWalletPacks: WalletCreditPack[] = [
  {
    id: "limit_50_lakh",
    code: "limit_50_lakh",
    label: "50 Lakhs",
    creditAmount: 5_000_000,
    priceAmount: 10_000,
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "limit_1_cr",
    code: "limit_1_cr",
    label: "1 Cr",
    creditAmount: 10_000_000,
    priceAmount: 20_000,
    badge: "Recommended",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "limit_2_cr",
    code: "limit_2_cr",
    label: "2 Cr",
    creditAmount: 20_000_000,
    priceAmount: 40_000,
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "limit_4_cr",
    code: "limit_4_cr",
    label: "4 Cr",
    creditAmount: 40_000_000,
    priceAmount: 80_000,
    sortOrder: 40,
    isActive: true,
  },
  {
    id: "limit_6_cr",
    code: "limit_6_cr",
    label: "6 Cr",
    creditAmount: 60_000_000,
    priceAmount: 120_000,
    sortOrder: 50,
    isActive: true,
  },
  {
    id: "limit_8_cr",
    code: "limit_8_cr",
    label: "8 Cr",
    creditAmount: 80_000_000,
    priceAmount: 160_000,
    sortOrder: 60,
    isActive: true,
  },
  {
    id: "limit_10_cr",
    code: "limit_10_cr",
    label: "10 Cr",
    creditAmount: 100_000_000,
    priceAmount: 200_000,
    sortOrder: 70,
    isActive: true,
  },
];

export const defaultWalletPackCode = "limit_1_cr";
export const currentWalletPackCatalogVersion = 2;

export function reconcileWalletCreditPacks(
  serverPacks: WalletCreditPack[],
  catalogVersion?: number,
): WalletCreditPack[] {
  const validServerPacks = serverPacks.filter(
    (pack) =>
      pack.isActive &&
      Boolean(pack.id && pack.code) &&
      Number.isFinite(Number(pack.creditAmount)) &&
      Number(pack.creditAmount) > 0 &&
      Number.isFinite(Number(pack.priceAmount)) &&
      Number(pack.priceAmount) > 0,
  );
  const sortPacks = (items: WalletCreditPack[]) =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  if (
    Number(catalogVersion || 0) >= currentWalletPackCatalogVersion
  ) {
    return sortPacks(validServerPacks);
  }

  const packsByCode = new Map(
    fallbackWalletPacks.map((pack) => [pack.code, { ...pack }]),
  );
  validServerPacks.forEach((pack) => {
    packsByCode.set(pack.code, {
      ...packsByCode.get(pack.code),
      ...pack,
    });
  });
  return sortPacks(Array.from(packsByCode.values()));
}
