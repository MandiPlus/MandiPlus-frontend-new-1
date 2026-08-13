export type InsuranceCreationAudience = {
  isPrivilegedActor: boolean;
  usesInternalFlow: boolean;
  canCreateOnMobile: boolean;
};

type InsuranceCreationAudienceInput = {
  user: Record<string, unknown> | null;
  hasDirectAdminSession: boolean;
  hasAdminActorSession: boolean;
};

const INTERNAL_MOBILE_INVOICE_CREATORS = new Set([
  "8789250356",
  "8904628742",
]);

function normalizedIndianMobile(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

export function isAllowedInternalMobileInvoiceCreator(
  user: Record<string, unknown> | null,
): boolean {
  const identity = String(user?.identity || "").trim().toUpperCase();
  if (identity !== "INTERNAL_TEAM") return false;

  const mobile = normalizedIndianMobile(
    user?.mobileNumber || user?.phoneNumber || user?.phone || user?.mobile,
  );
  return INTERNAL_MOBILE_INVOICE_CREATORS.has(mobile);
}

export function isInternalInsuranceUser(
  user: Record<string, unknown> | null,
): boolean {
  const identity = String(user?.identity || "").trim().toUpperCase();
  const role = String(user?.role || "").trim().toUpperCase();
  return identity === "INTERNAL_TEAM" || role === "ADMIN";
}

export function resolveInsuranceCreationAudience({
  user,
  hasDirectAdminSession,
  hasAdminActorSession,
}: InsuranceCreationAudienceInput): InsuranceCreationAudience {
  const isInternalUser = isInternalInsuranceUser(user);

  return {
    isPrivilegedActor: isInternalUser || hasAdminActorSession,
    // An impersonating admin remains a privileged actor for the device rule,
    // while the impersonated customer still receives the customer flow on desktop.
    usesInternalFlow: isInternalUser || hasDirectAdminSession,
    canCreateOnMobile:
      isAllowedInternalMobileInvoiceCreator(user) && !hasAdminActorSession,
  };
}
