const ADMIN_ACCOUNT_MOBILE_KEY = "adminAccountMobile";

export function persistAdminAccountMobile(mobile?: string | null) {
  if (typeof window === "undefined") return;
  const digits = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10) {
    localStorage.setItem(ADMIN_ACCOUNT_MOBILE_KEY, digits);
    return;
  }
  localStorage.removeItem(ADMIN_ACCOUNT_MOBILE_KEY);
}

export function getPersistedAdminAccountMobile(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_ACCOUNT_MOBILE_KEY);
}
