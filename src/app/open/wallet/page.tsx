"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

const APP_DEEP_LINK = "mandipluscustomer://wallet/add-money";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mandiplus.customer";
const PLAY_STORE_FALLBACK_DELAY_MS = 2200;

export default function OpenWalletPage() {
  const fallbackTimerRef = useRef<number | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const openWallet = useCallback(() => {
    clearFallback();
    window.location.href = APP_DEEP_LINK;
    fallbackTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.replace(PLAY_STORE_URL);
      }
    }, PLAY_STORE_FALLBACK_DELAY_MS);
  }, [clearFallback]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearFallback();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    openWallet();

    return () => {
      clearFallback();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearFallback, openWallet]);

  return (
    <main className="min-h-dvh bg-[#f6f7fb] px-6 py-10 text-[#151b26]">
      <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col items-center justify-center text-center">
        <Image
          src="/icons/icon-192.png"
          alt="MandiPlus"
          width={72}
          height={72}
          priority
          className="rounded-2xl"
        />

        <h1 className="mt-6 text-2xl font-bold tracking-[-0.02em]">
          MandiPlus Wallet
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]" aria-live="polite">
          Wallet khul raha hai…
        </p>

        <button
          type="button"
          onClick={openWallet}
          className="mt-8 min-h-12 w-full rounded-xl bg-[#203044] px-5 text-base font-semibold text-white transition-opacity active:opacity-80"
        >
          Open MandiPlus
        </button>

        <a
          href={PLAY_STORE_URL}
          className="mt-4 text-sm font-semibold text-[#203044] underline decoration-[#b7bec8] underline-offset-4"
        >
          Get it on Google Play
        </a>
      </section>
    </main>
  );
}
