"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token") || "";
    const userId = searchParams.get("userId") || "";
    const userName = searchParams.get("userName") || "";

    if (!token) {
      router.replace("/admin/users");
      return;
    }

    localStorage.setItem("impersonationActive", "1");
    localStorage.setItem("impersonatedUserId", userId);
    localStorage.setItem("impersonatedUserName", userName);
    localStorage.setItem("impersonationStartedAt", new Date().toISOString());
    localStorage.removeItem("user");
    setAuthToken(token, { tabOnly: true });

    const redirectPath = getRedirectPathFromToken(token);
    router.replace(redirectPath);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">Opening account in this tab...</p>
    </div>
  );
}
