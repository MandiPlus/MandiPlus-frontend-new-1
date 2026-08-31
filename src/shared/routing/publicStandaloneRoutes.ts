const PUBLIC_STANDALONE_ROUTES = new Set([
  "/account-deletion",
  "/docs/mou",
  "/pricing",
  "/privacy-policy",
  "/refund-policy",
  "/support",
  "/terms-and-conditions",
]);

export function isPublicStandaloneRoute(pathname: string | null): boolean {
  if (!pathname) return false;

  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return PUBLIC_STANDALONE_ROUTES.has(normalizedPath);
}
