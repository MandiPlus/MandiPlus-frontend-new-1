"use client";

import dynamic from "next/dynamic";

import { useAuth } from "@/features/auth/context/AuthContext";
import CustomerHomePage from "@/features/customer-app/CustomerHomePage";

const LegacyHomePage = dynamic(
  () => import("@/features/home/HomePage"),
  { ssr: false },
);

function isInternalHomeUser(user: Record<string, unknown> | null) {
  const identity = String(user?.identity || "").trim().toUpperCase();
  const role = String(user?.role || "").trim().toUpperCase();
  return identity === "INTERNAL_TEAM" || role === "ADMIN";
}

export default function Page() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-[#f5f6fb]"
        role="status"
        aria-label="Loading home"
      />
    );
  }

  return isInternalHomeUser(user) ? <LegacyHomePage /> : <CustomerHomePage />;
}
