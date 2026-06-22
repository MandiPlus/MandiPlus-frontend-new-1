"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowRight,
  Download,
  MessageCircle,
  Phone,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";

const WHATSAPP_URL = "https://wa.me/919900186757?text=Hi%20Mandiplus";
const CALL_URL = "tel:+919900186757";

const steps = [
  {
    title: "Bill WhatsApp par daalo",
    text: "Invoice, weighment slip, LR - jo hai, photo bhej do.",
  },
  {
    title: "Team details dekh legi",
    text: "Load value, route, truck number - sab confirm kar lenge.",
  },
  {
    title: "Tracking saath chalegi",
    text: "Policy, tracking aur claim help truck ke saath rahegi.",
  },
];

const risks = [
  "Accident",
  "Theft",
  "Maal gayab",
  "Driver issue",
  "Weather damage",
  "Fire",
];

const brochures = [
  {
    label: "English",
    href: "/brochures/Mandi-Plus-brochure-English-compressed.pdf",
  },
  {
    label: "Hindi",
    href: "/brochures/Mandi-Plus-brochure-Hindi-compressed.pdf",
  },
  {
    label: "Kannada",
    href: "/brochures/mandi-plus-brochure-kannada.pdf",
  },
];

const LandingPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5eadb]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5eadb] text-[#241b14]">
      <section className="relative isolate min-h-[88vh] overflow-hidden">
        <Image
          src="/images/mandiplus-hero-mandi-route.png"
          alt="Mandi trader preparing truck dispatch with bill and WhatsApp support"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-30 h-full w-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(28,21,15,0.9)_0%,rgba(28,21,15,0.68)_42%,rgba(28,21,15,0.16)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-[linear-gradient(180deg,rgba(245,234,219,0)_0%,#f5eadb_92%)]" />

        <div className="mx-auto flex min-h-[88vh] max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3" aria-label="Mandiplus home">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-lg font-black text-[#4309ac] shadow-sm">
                M+
              </span>
              <span className="leading-tight text-white">
                <span className="block text-xl font-black">
                  Mandi<span className="text-[#b79cff]">Plus</span>
                </span>
                <span className="block text-xs font-bold text-white/72">
                  Risk Humara, Munafa Aapka
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-bold text-white/72 md:flex">
              <a href="#how" className="transition hover:text-white">
                Kaise
              </a>
              <a href="#risk" className="transition hover:text-white">
                Risk
              </a>
              <Link href="/login" className="transition hover:text-white">
                Login
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-14 md:py-18">
            <div className="w-full max-w-[22rem] text-white sm:max-w-[38rem]">
              <h1 className="text-[3.05rem] font-black leading-[0.96] sm:text-7xl lg:text-[5.7rem]">
                <span className="block">Maal nikle.</span>
                <span className="block">Tension nahi.</span>
              </h1>

              <p className="mt-6 max-w-[22rem] text-lg font-bold leading-8 text-white/86 sm:max-w-xl sm:text-2xl sm:leading-9">
                Bill WhatsApp par daal do. Team route, truck aur value dekh ke
                cover chalu karwa degi.
              </p>
              <p className="mt-3 text-base font-black text-white/76">
                ₹1 lakh ke load ka cover ₹200 se start.
              </p>

              <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
                <a
                  href={WHATSAPP_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25d366] px-5 py-4 text-base font-black text-[#062f17] shadow-[0_20px_50px_-28px_rgba(37,211,102,0.9)] transition hover:-translate-y-0.5 hover:bg-[#35e277]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Bill WhatsApp par bhejo
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-white/24 bg-white/10 px-5 py-4 text-base font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  Login
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 pt-4 sm:px-6 lg:px-8" id="how">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#7a5525]">
              Bas itna
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Aap bill bhejo. Baaki Mandiplus ki jimmedari.
            </h2>
          </div>

          <div className="mt-8 grid gap-0 overflow-hidden rounded-xl border border-[#d9c7af] bg-[#fffaf2] md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="border-b border-[#d9c7af] p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
              >
                <span className="text-sm font-black text-[#7a5525]">
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-2xl font-black">{step.title}</h3>
                <p className="mt-2 text-base font-medium leading-7 text-[#6c5d4d]">
                  {step.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8" id="risk">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#7a5525]">
              Raste ka darr
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Truck nikle toh Mandiplus saath chale.
            </h2>
          </div>

          <div className="rounded-xl border border-[#d9c7af] bg-[#fffaf2] p-5 sm:p-7">
            <p className="text-2xl font-black leading-snug sm:text-3xl">
              Accident, maal gayab, driver issue, weather damage...
            </p>
            <p className="mt-4 text-lg font-semibold leading-8 text-[#6c5d4d]">
              Uss time trader ko policy language nahi chahiye. Phone uthane
              wali team chahiye, jo bole: yeh photo bhejo, yeh paper sambhalo,
              next step yeh hai.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {risks.map((risk) => (
                <span
                  key={risk}
                  className="rounded-full border border-[#d9c7af] bg-[#f5eadb] px-3 py-1.5 text-sm font-black text-[#4c3f33]"
                >
                  {risk}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 rounded-xl border border-[#d9c7af] bg-[#241b14] p-6 text-white md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <h2 className="mt-3 text-4xl font-black sm:text-5xl">
              ₹1 lakh load = ₹200
            </h2>
            <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-white/68">
              Aap load value bhejo. Team premium, policy aur tracking ka next
              step bata degi.
            </p>
          </div>
          <a
            href={WHATSAPP_URL}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25d366] px-5 py-4 text-base font-black text-[#062f17] transition hover:bg-[#35e277]"
          >
            <MessageCircle className="h-5 w-5" />
            Aaj ka load cover karna hai
          </a>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#d9c7af] bg-[#fffaf2]">
            <Image
              src="/images/logo.jpeg"
              alt="Mandiplus logo - Risk Humara, Munafa Aapka"
              fill
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="object-contain p-10"
            />
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#7a5525]">
              Mandiplus
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Mandi ke dispatch ko simple rakhne ke liye.
            </h2>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-[#6c5d4d]">
              Bill WhatsApp par bhejo, team route aur value dekh legi, aur
              truck ke saath cover, tracking aur claim help ready rahegi.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {brochures.map((brochure) => (
                <a
                  key={brochure.href}
                  href={brochure.href}
                  className="inline-flex items-center gap-2 rounded-md border border-[#d9c7af] bg-[#fffaf2] px-4 py-3 text-sm font-black text-[#241b14] transition hover:border-[#7a5525] hover:text-[#7a5525]"
                >
                  <Download className="h-4 w-4" />
                  {brochure.label} brochure
                </a>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-5 text-sm font-black text-[#6c5d4d]">
              <Link href="/pricing" className="hover:text-[#7a5525]">
                Pricing
              </Link>
              <Link href="/support" className="hover:text-[#7a5525]">
                Support
              </Link>
              <Link href="/terms-and-conditions" className="hover:text-[#7a5525]">
                Terms
              </Link>
              <Link href="/privacy-policy" className="hover:text-[#7a5525]">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-28 pt-4 sm:px-6 lg:px-8 md:pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-xl border border-[#d9c7af] bg-[#fffaf2] p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <h2 className="text-3xl font-black">
              Aaj truck nikal raha hai?
            </h2>
            <p className="mt-2 text-base font-semibold text-[#6c5d4d]">
              Bill bhejo. Team details dekh ke bata degi kya chahiye.
            </p>
          </div>
          <a
            href={WHATSAPP_URL}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#25d366] px-5 py-4 text-base font-black text-[#062f17] transition hover:bg-[#35e277]"
          >
            <MessageCircle className="h-5 w-5" />
            Bill WhatsApp par bhejo
          </a>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9c7af] bg-[#fffaf2]/96 px-3 py-3 shadow-[0_-18px_40px_-30px_rgba(36,27,20,0.6)] backdrop-blur md:hidden">
        <div className="mx-auto grid w-full max-w-[22rem] grid-cols-2 gap-2">
          <a
            href={WHATSAPP_URL}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-md bg-[#25d366] px-2 py-3 text-sm font-black text-[#062f17]"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">Bill bhejo</span>
          </a>
          <a
            href={CALL_URL}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-md bg-[#241b14] px-2 py-3 text-sm font-black text-white"
          >
            <Phone className="h-4 w-4 shrink-0" />
            <span className="truncate">Call</span>
          </a>
        </div>
      </div>
    </main>
  );
};

export default LandingPage;
