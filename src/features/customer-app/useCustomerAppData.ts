"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  invoicesLoaded: boolean;
  invoiceError: string | null;
  refresh: (silent?: boolean) => Promise<void>;
};

const REFRESH_MS = 30_000;

export function useCustomerAppData(): CustomerAppData {
  const { user } = useAuth();
  const [invoiceState, setInvoiceState] = useState<{
    accountKey: string;
    invoices: CustomerInvoice[];
    loaded: boolean;
    error: string | null;
  }>({
    accountKey: "",
    invoices: [],
    loaded: false,
    error: null,
  });
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletAccountKey, setWalletAccountKey] = useState("");
  const [partnerActive, setPartnerActive] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accountKey = String(user?.id || user?.mobileNumber || "");
  const accountKeyRef = useRef(accountKey);
  const inFlight = useRef<{
    accountKey: string;
    promise: Promise<void>;
  } | null>(null);
  const identity = String(user?.identity || "").toUpperCase();
  const billingType = String(user?.billingType || "").toUpperCase();
  const hasWallet =
    Boolean(user?.isCustomer) ||
    identity === "CUSTOMER" ||
    (identity === "TRANSPORTER" && billingType === "BULK");

  useLayoutEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!accountKey) {
        setLoading(false);
        return;
      }
      if (inFlight.current?.accountKey === accountKey) {
        return inFlight.current.promise;
      }
      if (!silent) setLoading(true);
      setError(null);
      const requestAccountKey = accountKey;
      const isCurrentAccount = () =>
        accountKeyRef.current === requestAccountKey;
      setInvoiceState((current) =>
        current.accountKey === requestAccountKey
          ? { ...current, error: null }
          : {
              accountKey: requestAccountKey,
              invoices: [],
              loaded: false,
              error: null,
            },
      );

      const task = (async () => {
        const invoiceRequest = getCustomerDashboardInvoices()
          .then((value) => {
            if (isCurrentAccount()) {
              setInvoiceState({
                accountKey: requestAccountKey,
                invoices: value as CustomerInvoice[],
                loaded: true,
                error: null,
              });
            }
            return value;
          })
          .catch((reason) => {
            if (isCurrentAccount()) {
              setInvoiceState((current) => ({
                accountKey: requestAccountKey,
                invoices:
                  current.accountKey === requestAccountKey
                    ? current.invoices
                    : [],
                loaded:
                  current.accountKey === requestAccountKey
                    ? current.loaded
                    : false,
                error:
                  "Latest payment details could not be loaded. Please retry.",
              }));
            }
            throw reason;
          });
        const claimRequest = getCustomerDashboardClaims().then((value) => {
          if (isCurrentAccount()) setClaims(value);
          return value;
        });
        const walletRequest = hasWallet
          ? getMyWalletSummary().then((value) => {
              if (isCurrentAccount()) {
                setWallet(value);
                setWalletAccountKey(requestAccountKey);
              }
              return value;
            })
          : Promise.resolve(null);
        const partnerRequest = getMyChannelPartnerDashboard({
          scope: "profile",
        }).then((value) => {
          const profile = value?.profile;
          if (isCurrentAccount()) {
            setPartnerActive(
              String(profile?.status || "").toUpperCase() === "ACTIVE",
            );
            setPartnerCode(String(profile?.code || ""));
          }
          return value;
        });

        const [invoiceResult, claimResult, walletResult, partnerResult] =
          await Promise.allSettled([
            invoiceRequest,
            claimRequest,
            walletRequest,
            partnerRequest,
          ]);

        if (partnerResult.status === "rejected" && isCurrentAccount()) {
          setPartnerActive(false);
          setPartnerCode("");
        }

        if (isCurrentAccount()) {
          if (invoiceResult.status === "rejected") {
            setError(
              "Latest payment details could not be loaded. Please retry.",
            );
          } else if (
            claimResult.status === "rejected" &&
            (!hasWallet || walletResult.status === "rejected")
          ) {
            setError(
              "Latest account details could not be loaded. Pull to retry.",
            );
          }
        }
      })()
        .finally(() => {
          if (inFlight.current?.promise === task) inFlight.current = null;
          if (isCurrentAccount()) setLoading(false);
        });

      inFlight.current = { accountKey: requestAccountKey, promise: task };
      return task;
    },
    [accountKey, hasWallet],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void refresh());
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  useEffect(() => {
    if (!accountKey) return;
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
  }, [accountKey, refresh]);

  const invoices = useMemo(
    () =>
      invoiceState.accountKey === accountKey ? invoiceState.invoices : [],
    [accountKey, invoiceState],
  );
  const invoicesLoaded =
    invoiceState.accountKey === accountKey && invoiceState.loaded;
  const invoiceError =
    invoiceState.accountKey === accountKey ? invoiceState.error : null;
  const visibleWallet = walletAccountKey === accountKey ? wallet : null;

  return useMemo(
    () => ({
      invoices,
      claims,
      wallet: visibleWallet,
      partnerActive,
      partnerCode,
      loading,
      error,
      invoicesLoaded,
      invoiceError,
      refresh,
      pendingInvoices: invoices.filter(isPayableInvoice),
      checkoutInvoices: invoices.filter(isCheckoutReady),
      policyInvoices: invoices.filter((invoice) => Boolean(getInsuranceUrl(invoice))),
      activeClaims: claims.filter((claim) => !isClosedClaim(claim)),
    }),
    [
      claims,
      error,
      invoiceError,
      invoices,
      invoicesLoaded,
      loading,
      partnerActive,
      partnerCode,
      refresh,
      visibleWallet,
    ],
  ) as CustomerAppData;
}
