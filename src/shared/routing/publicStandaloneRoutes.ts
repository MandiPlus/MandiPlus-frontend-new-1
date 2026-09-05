const PUBLIC_STANDALONE_ROUTES = new Set([
  "/account-deletion",
  "/docs/mou",
  "/mandi",
  "/pricing",
  "/promo",
  "/privacy-policy",
  "/refund-policy",
  "/support",
  "/terms-and-conditions",
]);

/** Token routes: every path under these prefixes is public. */
const PUBLIC_STANDALONE_PREFIXES = ["/m"];

export function isPublicStandaloneRoute(pathname: string | null): boolean {
  if (!pathname) return false;

  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (PUBLIC_STANDALONE_ROUTES.has(normalizedPath)) return true;

  return PUBLIC_STANDALONE_PREFIXES.some((prefix) =>
    normalizedPath.startsWith(`${prefix}/`),
  );
}
