export type InsuranceCreationAudience = {
  isPrivilegedActor: boolean;
  usesInternalFlow: boolean;
  canCreateOnMobile: boolean;
};

type InsuranceCreationAudienceInput = {
  user: Record<string, unknown> | null;
  hasDirectAdminSession: boolean;
  hasAdminActorSession: boolean;
  adminMobileNumber?: string | null;
};

const INTERNAL_MOBILE_INVOICE_CREATORS = new Set([
  "8904628742",
]);

function normalizedIndianMobile(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

export function isAllowedInternalMobileNumber(value: unknown): boolean {
  const mobile = normalizedIndianMobile(value);
  return Boolean(mobile) && INTERNAL_MOBILE_INVOICE_CREATORS.has(mobile);
}

export function isAllowedInternalMobileInvoiceCreator(
  user: Record<string, unknown> | null,
): boolean {
  const identity = String(user?.identity || "").trim().toUpperCase();
  if (identity !== "INTERNAL_TEAM") return false;

  return isAllowedInternalMobileNumber(
    user?.mobileNumber ||
      user?.secondaryMobileNumber ||
      user?.phoneNumber ||
      user?.phone ||
      user?.mobile,
  );
}

export function isInternalInsuranceUser(
  user: Record<string, unknown> | null,
): boolean {
  const identity = String(user?.identity || "").trim().toUpperCase();
  const role = String(user?.role || "").trim().toUpperCase();
  return identity === "INTERNAL_TEAM" || role === "ADMIN";
}

export function canUseInternalRateCalculator(
  user: Record<string, unknown> | null,
  hasDirectAdminSession: boolean,
): boolean {
  const identity = String(user?.identity || "").trim().toUpperCase();
  return (
    hasDirectAdminSession ||
    isInternalInsuranceUser(user) ||
    identity === "AGENT"
  );
}

export function resolveInsuranceCreationAudience({
  user,
  hasDirectAdminSession,
  hasAdminActorSession,
  adminMobileNumber,
}: InsuranceCreationAudienceInput): InsuranceCreationAudience {
  const isInternalUser = isInternalInsuranceUser(user);
  const canCreateOnMobile =
    (isAllowedInternalMobileInvoiceCreator(user) ||
      isAllowedInternalMobileNumber(adminMobileNumber)) &&
    !hasAdminActorSession;

  return {
    isPrivilegedActor: isInternalUser || hasAdminActorSession,
    // An impersonating admin remains a privileged actor for the device rule,
    // while the impersonated customer still receives the customer flow on desktop.
    usesInternalFlow: isInternalUser || hasDirectAdminSession,
    canCreateOnMobile,
  };
}
