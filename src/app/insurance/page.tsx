"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/context/AuthContext";
import CustomerCreateInsurancePage from "@/features/customer-app/CustomerCreateInsurancePage";

const LegacyInsurance = dynamic(
  () => import("@/features/insurance/pages/Insurance"),
  { ssr: false },
);

const LegacyInsuranceIOS = dynamic(
  () => import("@/features/insurance/pages/InsuranceIOS"),
  { ssr: false },
);

function isInternalInsuranceUser(user: Record<string, unknown> | null) {
  const identity = String(user?.identity || "").trim().toUpperCase();
  const role = String(user?.role || "").trim().toUpperCase();
  return identity === "INTERNAL_TEAM" || role === "ADMIN";
}

export default function InsurancePage() {
  const { user, loading } = useAuth();
  const [deviceReady, setDeviceReady] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(userAgent) &&
      !(window as typeof window & { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

    setIsIOSSafari(isIOSDevice && isSafari);
    setDeviceReady(true);
  }, []);

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-[#f5f6fb]"
        role="status"
        aria-label="Loading insurance"
      />
    );
  }

  if (!isInternalInsuranceUser(user)) {
    return <CustomerCreateInsurancePage />;
  }

  if (!deviceReady) {
    return (
      <div
        className="fixed inset-0 bg-[#efeae2]"
        role="status"
        aria-label="Loading insurance"
      />
    );
  }

  return isIOSSafari ? <LegacyInsuranceIOS /> : <LegacyInsurance />;
}
