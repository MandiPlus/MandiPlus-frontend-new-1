/**
 * Where the POS app's APKs are served from. release.sh in pinelabsapp publishes every build to
 * mandipos-api, and the download link there always serves the newest one, so the website never
 * needs editing for a new version.
 */
export const POS_API_URL = (process.env.POS_API_URL?.trim() || "https://mandipos-api.onrender.com").replace(/\/+$/, "");

export type PosFlavor = "pos" | "daybook";

/** The APK itself: always the newest build. */
export function apkUrl(flavor: PosFlavor) {
  return `${POS_API_URL}/v1/public/app/download?flavor=${flavor}`;
}

/** The Tally connector for the shop's Windows laptop (a zip): always the newest build. */
export function tallyConnectorUrl() {
  return `${POS_API_URL}/v1/public/app/download?flavor=tally`;
}

/** MandiPlus Dashboard, the owners' portal as a Windows app (one exe): always the newest build. */
export function dashboardAppUrl() {
  return `${POS_API_URL}/v1/public/app/download?flavor=desktop`;
}

/** MandiPlus Dashboard New, the same Windows app on the new-look (beta) portal: always the newest build. */
export function dashboardAppNewUrl() {
  return `${POS_API_URL}/v1/public/app/download?flavor=desktop-new`;
}
