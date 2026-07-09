"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ArrowLeft } from "lucide-react";
import { checkUser, sendOtp, verifyOtp } from "@/features/auth/api";
import { useAuth } from "../context/AuthContext";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleMobileChange = (value: string) => {
    setMobileNumber(value.replace(/\D/g, "").slice(0, 10));
  };

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/\D/g, "").slice(0, 6));
  };

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0 || !mobileNumber) return;
    try {
      await sendOtp({ mobileNumber });
      setResendCooldown(30);
      toast.success("OTP dobara bhej diya");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "OTP resend nahi ho paya"));
    }
  }, [resendCooldown, mobileNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (step === "PHONE") {
        if (mobileNumber.length !== 10) {
          toast.error("10 digit mobile number daalo");
          setIsLoading(false);
          return;
        }

        const userCheck = await checkUser({ mobileNumber });
        if (!userCheck.exists) {
          toast.info("Naya user hai. Signup complete karo.");
          router.push(`/register?mobile=${mobileNumber}`);
          setIsLoading(false);
          return;
        }

        await sendOtp({ mobileNumber });
        setStep("OTP");
        setResendCooldown(30);
        toast.success(`OTP ${mobileNumber} par bhej diya`);
      } else {
        if (otp.length !== 6) {
          toast.error("6 digit OTP daalo");
          setIsLoading(false);
          return;
        }

        const response = await verifyOtp({ mobileNumber, otp });

        if (response.next === "REGISTER") {
          toast.info("Naya user hai. Signup complete karo.");
          router.push(`/register?mobile=${mobileNumber}`);
        } else if (response.next === "HOME") {
          if (response.accessToken) {
            await login(response.accessToken, response.user);
            toast.success("Login ho gaya");
          } else {
            toast.error("Login failed: access token missing");
          }
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Kuch error aaya"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b3f2a] text-[#1f271b]">
      <div className="relative isolate flex min-h-screen items-center justify-center px-4 py-8">
        <Image
          src="/images/mandiplus-minimal-mandi-hero.png"
          alt="Mandi truck dispatch with bill and WhatsApp support"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-[rgba(4,35,23,0.48)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(215,242,141,0.08)_0%,rgba(4,35,23,0.68)_76%)]" />

        <div className="relative z-10 w-full max-w-md">
          <Link
            href="/"
            className="mx-auto mb-5 flex w-fit items-center gap-3 text-white"
            aria-label="Mandiplus home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-lg font-black text-[#4309ac] shadow-sm">
              M+
            </span>
            <span className="leading-tight">
              <span className="block text-xl font-black">
                Mandi<span className="text-[#b79cff]">Plus</span>
              </span>
              <span className="block text-xs font-bold text-white/74">
                Risk Humara, Munafa Aapka
              </span>
            </span>
          </Link>

          <section className="w-full rounded-md border border-[#c9bb96] bg-[#fbf5e7]/96 p-5 shadow-[0_28px_90px_-42px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-7">
            <div className="mb-7 text-center">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#2f6c3e]">
                Login
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#1f271b]">
                Phone pe OTP. Bas.
              </h2>
              <p className="mt-2 text-base font-medium leading-7 text-[#645640]">
                Registered number daalo, OTP verify karo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === "PHONE" ? (
                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="text-sm font-black text-[#183521]"
                  >
                    Registered mobile number
                  </label>
                  <div className="mt-2 flex w-full overflow-hidden rounded-md border border-[#c9bb96] bg-white focus-within:border-[#1f8b4c] focus-within:ring-2 focus-within:ring-[#1f8b4c]/18">
                    <span className="flex shrink-0 items-center border-r border-[#c9bb96] px-3 text-sm font-black text-[#645640]">
                      +91
                    </span>
                    <input
                      id="mobileNumber"
                      inputMode="numeric"
                      autoComplete="tel"
                      className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-bold text-[#1f271b] outline-none placeholder:text-[#b7aa9b]"
                      placeholder="10 digit number"
                      maxLength={10}
                      value={mobileNumber}
                      onChange={(e) => handleMobileChange(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label
                        htmlFor="otp"
                        className="text-sm font-black text-[#183521]"
                      >
                        OTP
                      </label>
                      <p className="mt-1 text-sm font-medium text-[#645640]">
                        {mobileNumber} par bheja hai.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("PHONE");
                        setOtp("");
                      }}
                      className="inline-flex items-center gap-1 text-sm font-black text-[#1f8b4c]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Change
                    </button>
                  </div>
                  <input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="mt-2 min-h-12 w-full rounded-md border border-[#c9bb96] bg-white px-3 text-center text-xl font-black tracking-[0.34em] text-[#1f271b] outline-none placeholder:text-[#b7aa9b] focus:border-[#1f8b4c] focus:ring-2 focus:ring-[#1f8b4c]/18"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#25d366] px-5 py-3 text-base font-black text-[#062f17] transition hover:bg-[#35e277] disabled:cursor-not-allowed disabled:bg-[#c7bdad] disabled:text-[#645640]"
              >
                {isLoading
                  ? "Ruko..."
                  : step === "PHONE"
                    ? "OTP bhejo"
                    : "Login karo"}
              </button>

              {step === "OTP" && (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="w-full text-center text-sm font-black text-[#1f8b4c] disabled:text-[#a79988]"
                >
                  {resendCooldown > 0
                    ? `OTP dobara ${resendCooldown}s mein`
                    : "OTP dobara bhejo"}
                </button>
              )}
            </form>

            <div className="mt-7 border-t border-[#c9bb96] pt-5 text-center">
              <div className="mb-5 rounded-md border border-[#c9bb96] bg-white/70 p-3 text-left">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2f6c3e]">
                  Test login for reviewers
                </p>
                <p className="mt-2 text-sm font-bold text-[#1f271b]">
                  Mobile: 9000000000
                </p>
                <p className="mt-1 text-sm font-bold text-[#1f271b]">
                  OTP: 123456
                </p>
              </div>
              <p className="text-sm font-medium text-[#645640]">
                Mandiplus par naye ho?{" "}
                <Link href="/register" className="font-black text-[#1f8b4c]">
                  Signup karo
                </Link>
              </p>
              <Link
                href="/admin/login"
                className="mt-4 inline-flex text-xs font-bold text-[#a79988] transition hover:text-[#1f8b4c]"
              >
                Admin login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
