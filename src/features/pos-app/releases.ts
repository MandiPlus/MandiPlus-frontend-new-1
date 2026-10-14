/**
 * The POS app's published builds, as mandipos-api serves them. release.sh in pinelabsapp
 * publishes every build there, so this page never needs editing for a new version.
 */
export const POS_API_URL = (process.env.POS_API_URL?.trim() || "https://mandipos-api.onrender.com").replace(/\/+$/, "");

export type PosFlavor = "pos" | "daybook";

export type PosRelease = {
  versionCode: number;
  versionName: string;
  sha256: string;
  sizeBytes: number;
  notes: string;
  publishedAt: string;
};

export type PosReleases = Record<PosFlavor, PosRelease | null>;

/** Seconds a fetched version is shown before the next visitor triggers a fresh read. */
export const RELEASES_REVALIDATE_SECONDS = 60;

/** The APK itself: always the newest build, whatever version the page last showed. */
export function apkUrl(flavor: PosFlavor) {
  return `${POS_API_URL}/v1/public/app/download?flavor=${flavor}`;
}

/** Null when the API can't be reached; the page still offers the download, just without a version. */
export async function fetchPosReleases(): Promise<PosReleases | null> {
  try {
    const res = await fetch(`${POS_API_URL}/v1/public/app`, {
      next: { revalidate: RELEASES_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as PosReleases;
  } catch {
    return null;
  }
}
