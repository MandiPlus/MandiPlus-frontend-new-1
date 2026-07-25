"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getMyChannelPartnerDashboard } from "@/features/channel-partner/api";
import {
  getCustomerDashboardClaims,
  getCustomerDashboardInvoices,
  getMyWalletSummary,
  type WalletSummary,
} from "@/features/customer/api";
import type { ClaimRequest } from "@/features/insurance/api";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  getInsuranceUrl,
  isCheckoutReady,
  isClosedClaim,
  isPayableInvoice,
  type CustomerInvoice,
} from "./utils";

export type CustomerAppData = {
  invoices: CustomerInvoice[];
  claims: ClaimRequest[];
  wallet: WalletSummary | null;
  partnerActive: boolean;
  partnerCode: string;
  loading: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<void>;
};

const REFRESH_MS = 30_000;

export function useCustomerAppData(): CustomerAppData {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [partnerActive, setPartnerActive] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const identity = String(user?.identity || "").toUpperCase();
  const billingType = String(user?.billingType || "").toUpperCase();
  const hasWallet =
    identity === "CUSTOMER" ||
    (identity === "TRANSPORTER" && billingType === "BULK");

  const refresh = useCallback(
    async (silent = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (inFlight.current) return inFlight.current;
      if (!silent) setLoading(true);
      setError(null);

      const task = (async () => {
        const [invoiceResult, claimResult, walletResult, partnerResult] =
          await Promise.allSettled([
            getCustomerDashboardInvoices(),
            getCustomerDashboardClaims(),
            hasWallet ? getMyWalletSummary() : Promise.resolve(null),
            getMyChannelPartnerDashboard(),
          ]);

        if (invoiceResult.status === "fulfilled") {
          setInvoices(invoiceResult.value as CustomerInvoice[]);
        }
        if (claimResult.status === "fulfilled") setClaims(claimResult.value);
        if (walletResult.status === "fulfilled") setWallet(walletResult.value);
        if (partnerResult.status === "fulfilled") {
          const profile = partnerResult.value?.profile;
          setPartnerActive(String(profile?.status || "").toUpperCase() === "ACTIVE");
          setPartnerCode(String(profile?.code || ""));
        } else {
          setPartnerActive(false);
          setPartnerCode("");
        }

        if (
          invoiceResult.status === "rejected" &&
          claimResult.status === "rejected" &&
          walletResult.status === "rejected"
        ) {
          setError("Latest account details could not be loaded. Pull to retry.");
        }
      })()
        .finally(() => {
          inFlight.current = null;
          setLoading(false);
        });

      inFlight.current = task;
      return task;
    },
    [hasWallet, user],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const interval = window.setInterval(tick, REFRESH_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, user]);

  return useMemo(
    () => ({
      invoices,
      claims,
      wallet,
      partnerActive,
      partnerCode,
      loading,
      error,
      refresh,
      pendingInvoices: invoices.filter(isPayableInvoice),
      checkoutInvoices: invoices.filter(isCheckoutReady),
      policyInvoices: invoices.filter((invoice) => Boolean(getInsuranceUrl(invoice))),
      activeClaims: claims.filter((claim) => !isClosedClaim(claim)),
    }),
    [
      claims,
      error,
      invoices,
      loading,
      partnerActive,
      partnerCode,
      refresh,
      wallet,
    ],
  ) as CustomerAppData;
}
