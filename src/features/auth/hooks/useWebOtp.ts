"use client";

import { useEffect, useRef } from "react";

type OtpCredential = Credential & {
  code: string;
};

export const useWebOtp = ({
  enabled,
  onCode,
}: {
  enabled: boolean;
  onCode: (code: string) => void;
}) => {
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      !("OTPCredential" in window) ||
      !navigator.credentials
    ) {
      return;
    }

    const controller = new AbortController();

    void navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: controller.signal,
      } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as OtpCredential | null)?.code;
        if (code && /^\d{4,10}$/.test(code)) {
          onCodeRef.current(code);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        // Manual OTP entry remains the fallback when WebOTP is unavailable,
        // dismissed, times out, or receives a message with the wrong format.
        console.debug("WebOTP unavailable", error);
      });

    return () => controller.abort();
  }, [enabled]);
};

