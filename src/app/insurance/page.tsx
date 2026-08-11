"use client";

import dynamic from "next/dynamic";

import { useAuth } from "@/features/auth/context/AuthContext";
import CustomerCreateInsurancePage from "@/features/customer-app/CustomerCreateInsurancePage";
import {
  resolveInsuranceCreationAudience,
} from "@/features/insurance/creationAccessPolicy";
import {
  hasStoredInsuranceAdminActorSession,
  hasStoredInsuranceAdminSession,
} from "@/features/insurance/api";
import DesktopRequiredNotice from "@/shared/components/DesktopRequiredNotice";
import { useDesktopCreationAccess } from "@/shared/hooks/useDesktopCreationAccess";

const LegacyInsurance = dynamic(
  () => import("@/features/insurance/pages/Insurance"),
  { ssr: false },
);

export default function InsurancePage() {
  const { user, loading } = useAuth();
  const desktopAccess = useDesktopCreationAccess();

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-[#f5f6fb]"
        role="status"
        aria-label="Loading insurance"
      />
    );
  }

  const hasDirectAdminSession = hasStoredInsuranceAdminSession();
  const audience = resolveInsuranceCreationAudience({
    user,
    hasDirectAdminSession,
    hasAdminActorSession: hasStoredInsuranceAdminActorSession(),
  });

  if (!audience.isPrivilegedActor) {
    return <CustomerCreateInsurancePage />;
  }

  if (!desktopAccess.ready) {
    return (
      <div
        className="fixed inset-0 bg-[#efeae2]"
        role="status"
        aria-label="Loading insurance"
      />
    );
  }

  if (!desktopAccess.allowed) {
    return (
      <DesktopRequiredNotice
        returnHref={hasDirectAdminSession ? "/admin/insurance-forms" : "/home"}
        returnLabel={hasDirectAdminSession ? "Go to admin invoices" : "Back to home"}
      />
    );
  }

  if (!audience.usesInternalFlow) {
    return <CustomerCreateInsurancePage />;
  }

  return <LegacyInsurance />;
}
