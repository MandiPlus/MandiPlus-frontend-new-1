export type InsuranceCreationAudience = {
  isPrivilegedActor: boolean;
  usesInternalFlow: boolean;
};

type InsuranceCreationAudienceInput = {
  user: Record<string, unknown> | null;
  hasDirectAdminSession: boolean;
  hasAdminActorSession: boolean;
};

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
}: InsuranceCreationAudienceInput): InsuranceCreationAudience {
  const isInternalUser = isInternalInsuranceUser(user);

  return {
    isPrivilegedActor: isInternalUser || hasAdminActorSession,
    // An impersonating admin remains a privileged actor for the device rule,
    // while the impersonated customer still receives the customer flow on desktop.
    usesInternalFlow: isInternalUser || hasDirectAdminSession,
  };
}
