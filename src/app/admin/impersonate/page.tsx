"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { setAuthToken } from "@/features/auth/api";

function getRedirectPathFromToken(token: string): string {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return "/home";
    const payload = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    const identity = payload?.identity;
    if (identity === "AGENT") return "/agent/dashboard";
    if (identity === "CUSTOMER") return "/customer/dashboard";
    if (identity === "TRANSPORTER") return "/transporter/dashboard";
    if (identity === "INTERNAL_TEAM") return "/home";
    return "/home";
  } catch {
    return "/home";
  }
}

export default function AdminImpersonatePage() {
  const searchParams = useSearchParams();
  const didBootstrapRef = useRef(false);

  useEffect(() => {
    if (didBootstrapRef.current) {
      return;
    }

    const token = searchParams.get("token") || "";
    const userId = searchParams.get("userId") || "";
    const userName = searchParams.get("userName") || "";

    if (!token) {
      window.location.replace("/admin/users");
      return;
    }

    didBootstrapRef.current = true;
    sessionStorage.setItem("impersonationActive", "1");
    sessionStorage.setItem("impersonatedUserId", userId);
    sessionStorage.setItem("impersonatedUserName", userName);
    sessionStorage.setItem("impersonationStartedAt", new Date().toISOString());
    localStorage.removeItem("user");
    setAuthToken(token, { tabOnly: true, suppressEvent: true });

    const redirectPath = getRedirectPathFromToken(token);
    window.location.replace(redirectPath);
  }, [searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">Opening account in this tab...</p>
    </div>
  );
}
