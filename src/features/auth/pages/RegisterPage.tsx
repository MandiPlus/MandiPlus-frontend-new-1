"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";

import { register, sendOtp, verifyOtp } from "@/features/auth/api";
import { useWebOtp } from "@/features/auth/hooks/useWebOtp";
import { useAuth } from "../context/AuthContext";
import styles from "./customer-auth.module.css";

type AuthStep = "phone" | "otp";

export default function RegisterPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationInFlight = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(
      () => setResendCooldown((current) => current - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const requestOtp = useCallback(async () => {
    if (phone.length !== 10 || loading) {
      if (phone.length !== 10) setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await sendOtp({ mobileNumber: phone });
      setOtp("");
      setStep("otp");
      setResendCooldown(30);
    } catch (nextError) {
      setError(errorMessage(nextError, "Unable to send OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [loading, phone]);

  const verifyAndContinue = useCallback(
    async (code: string) => {
      if (verificationInFlight.current || loading) return;
      if (code.length !== 6) {
        setError("Enter the OTP sent to your mobile number.");
        return;
      }

      verificationInFlight.current = true;
      setLoading(true);
      setError("");
      try {
        const verification = await verifyOtp({ mobileNumber: phone, otp: code });
        let response = verification;

        if (verification.next === "REGISTER") {
          response = await register({
            name: "MandiPlus User",
            mobileNumber: phone,
            state: "MAHARASHTRA",
          });
        }

        if (!response.accessToken) {
          throw new Error("Unable to start your account. Please try again.");
        }

        await login(response.accessToken, response.user);
      } catch (nextError) {
        setError(errorMessage(nextError, "The OTP entered is incorrect."));
      } finally {
        verificationInFlight.current = false;
        setLoading(false);
      }
    },
    [loading, login, phone],
  );

  useWebOtp({
    enabled: step === "otp" && !loading,
    onCode: (code) => {
      setOtp(code);
      void verifyAndContinue(code);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "phone") void requestOtp();
    else void verifyAndContinue(otp);
  };

  return (
    <main className={styles.screen}>
      <div className={styles.authFrame}>
        <section className={styles.hero} aria-label="Mandi Plus">
          <Image
            src="/customer-app/auth-mandi-helper-v3.webp"
            alt="Mandi Plus customer at a mandi"
            fill
            sizes="(max-width: 760px) 100vw, 480px"
            priority
            className={styles.heroImage}
          />
        </section>

        <section className={styles.sheet}>
          <div className={styles.message}>
            <h1>
              {step === "phone"
                ? "Mandi Plus mein aapka swagat hai"
                : "OTP dalein"}
            </h1>
            <p>
              {step === "phone"
                ? "Aage badhne ke liye mobile number dalein"
                : `Verification code bheja gaya hai +91 ${phone}.`}
            </p>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {step === "phone" ? (
              <input
                aria-label="Mobile number"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Mobile number dalein"
                maxLength={10}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                  setError("");
                }}
                className={styles.phoneInput}
              />
            ) : (
              <input
                aria-label="OTP"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                className={styles.otpInput}
              />
            )}

            {error ? <div className={styles.error}>{error}</div> : null}

            <button type="submit" disabled={loading} className={styles.primary}>
              {loading ? <LoaderCircle size={20} className="animate-spin" /> : null}
              {step === "phone" ? "Continue" : "OTP verify karein"}
            </button>

            {step === "otp" ? (
              <div className={styles.otpActions}>
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={() => void requestOtp()}
                >
                  {resendCooldown > 0
                    ? `OTP dobara bhejein (${resendCooldown}s)`
                    : "OTP dobara bhejein"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                >
                  <ArrowLeft size={15} />
                  Mobile number badlein
                </button>
              </div>
            ) : null}
          </form>

          <p className={styles.terms}>
            By signing in, you agree to our{" "}
            <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>,{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>, and{" "}
            <Link href="/refund-policy">Refund Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
