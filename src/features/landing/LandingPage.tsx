"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Download, MessageCircle, Phone, Route, Truck } from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";

const WHATSAPP_URL = "https://wa.me/919900186757?text=Hi%20Mandiplus";
const CALL_URL = "tel:+919900186757";

const identity = [
  {
    title: "Bill WhatsApp par bhejo!",
    text: "Mandi ka maal route par covered.",
  },
  {
    title: "Truck tracking",
    text: "Truck nikle toh update saath.",
  },
  {
    title: "Claim help",
    text: "Issue aaye toh phone uthayenge.",
  },
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

const tenderCoconutRoutes = ["Mandya", "Nanjangud", "Chamarajanagar", "Talavadi", "Pollachi"];

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
      <div className="flex min-h-screen items-center justify-center bg-[#edf3df]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#246b3d] border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f2ead7] text-[#1f271b]">
      <section className="relative isolate min-h-[92vh] overflow-hidden bg-[#082b1e] text-white">
        <Image
          src="/images/mandiplus-minimal-mandi-hero.png"
          alt="Mandi trader checking bill and phone before truck dispatch"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-30 h-full w-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(3,31,21,0.96)_0%,rgba(3,31,21,0.76)_42%,rgba(3,31,21,0.2)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(180deg,rgba(242,234,215,0)_0%,#f2ead7_100%)]" />

        <div className="mx-auto flex min-h-[92vh] max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3" aria-label="Mandiplus home">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-lg font-black text-[#4309ac] shadow-sm">
                M+
              </span>
              <span className="leading-tight">
                <span className="block text-xl font-black">
                  Mandi<span className="text-[#b79cff]">Plus</span>
                </span>
                <span className="block text-xs font-bold text-white/72">
                  Risk Humara, Munafa Aapka
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-bold text-white/72 md:flex">
              <a href="#identity" className="transition hover:text-white">
                Mandiplus
              </a>
              <a href="#brochure" className="transition hover:text-white">
                Brochure
              </a>
              <Link href="/login" className="transition hover:text-white">
                Login
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-12">
            <div className="max-w-[40rem]">
              <h1 className="text-[3.4rem] font-black leading-[0.94] sm:text-7xl lg:text-[6rem]">
                <span className="block">Risk humara.</span>
                <span className="block text-[#d9f4b5]">Munafa aapka.</span>
              </h1>
              <p className="mt-6 max-w-xl text-xl font-bold leading-8 text-white/84 sm:text-2xl sm:leading-9">
                Bill WhatsApp par bhejo. Baaki Mandiplus sambhalega.
              </p>

              <div className="mt-7 flex max-w-md flex-col gap-3 sm:flex-row">
                <a
                  href={WHATSAPP_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25d366] px-5 py-4 text-base font-black text-[#062f17] shadow-[0_24px_54px_-30px_rgba(37,211,102,0.95)] transition hover:-translate-y-0.5 hover:bg-[#35e277]"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp par bill bhejo
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

      <section id="identity" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#246b3d]">
            Mandiplus kya hai?
          </p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <h2 className="max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
              Maal nikla toh Mandiplus saath.
            </h2>
            <p className="max-w-xl text-lg font-semibold leading-8 text-[#645640]">
              Bill WhatsApp par bhejo!
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-[#c9bb96] bg-[#c9bb96] md:grid-cols-3">
            {identity.map((item) => (
              <article key={item.title} className="bg-[#fbf5e7] p-6">
                <h3 className="text-2xl font-black">{item.title}</h3>
                <p className="mt-3 text-base font-semibold leading-7 text-[#645640]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-md border border-[#c9bb96] bg-[#0b3f2a] lg:grid-cols-[1.04fr_0.96fr]">
          <div className="relative min-h-[25rem] overflow-hidden bg-[#fbf5e7] p-5 sm:p-7">
            <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#8f7d55_1px,transparent_1px),linear-gradient(90deg,#8f7d55_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="relative flex h-full min-h-[21rem] flex-col justify-between">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-md bg-[#d9f4b5] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#0b3f2a]">
                  <Route className="h-4 w-4" />
                  Tender Coconut Lane
                </span>
              </div>

              <div className="relative mx-auto mt-8 h-[15.5rem] w-full max-w-[32rem]">
                <svg
                  viewBox="0 0 520 248"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full"
                >
                  <path
                    d="M42 175 C118 106 173 208 236 132 C290 66 332 134 386 88 C421 58 456 50 492 68"
                    fill="none"
                    stroke="#246b3d"
                    strokeLinecap="round"
                    strokeWidth="16"
                  />
                  <path
                    d="M42 175 C118 106 173 208 236 132 C290 66 332 134 386 88 C421 58 456 50 492 68"
                    fill="none"
                    stroke="#d9f4b5"
                    strokeDasharray="3 26"
                    strokeLinecap="round"
                    strokeWidth="5"
                  />
                </svg>

                {tenderCoconutRoutes.map((route, index) => {
                  const positions = [
                    "left-[4%] top-[58%]",
                    "left-[21%] top-[30%]",
                    "left-[40%] top-[52%]",
                    "left-[60%] top-[23%]",
                    "left-[76%] top-[36%]",
                  ];

                  return (
                    <span
                      key={route}
                      className={`absolute ${positions[index]} inline-flex -translate-y-1/2 items-center gap-1.5 rounded-md border border-[#8f7d55] bg-[#f2c94c] px-3 py-2 text-xs font-black text-[#1f271b] shadow-[0_8px_0_-5px_rgba(31,39,27,0.32)] sm:text-sm`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-[#d92727] ring-2 ring-white" />
                      {route}
                    </span>
                  );
                })}

                <div className="absolute bottom-1 right-2 flex h-16 w-16 items-center justify-center rounded-full border border-[#c9bb96] bg-white text-[#0b3f2a] shadow-[0_18px_36px_-28px_rgba(31,39,27,0.72)]">
                  <Truck className="h-8 w-8" />
                </div>
              </div>

              <div />
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 text-white sm:p-8 lg:p-10">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
              Tender Coconut load nikla? Mandiplus saath hai.
            </h2>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-white/76">
              Bill WhatsApp par bhejo. Route, tracking aur issue support team dekhegi.
            </p>
            <a
              href={WHATSAPP_URL}
              className="mt-7 inline-flex w-fit items-center justify-center gap-2 rounded-md bg-[#25d366] px-5 py-4 text-base font-black text-[#062f17] shadow-[0_24px_54px_-30px_rgba(37,211,102,0.95)] transition hover:-translate-y-0.5 hover:bg-[#35e277]"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp par bill bhejo
            </a>
          </div>
        </div>
      </section>

      <section id="brochure" className="px-4 pb-28 pt-10 sm:px-6 lg:px-8 md:pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-[#c9bb96] pt-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#246b3d]">
              More details
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-black sm:text-4xl">
              Brochure chahiye toh yahin hai.
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {brochures.map((brochure) => (
              <a
                key={brochure.href}
                href={brochure.href}
                className="inline-flex items-center gap-2 rounded-md border border-[#c9bb96] bg-[#fbf5e7] px-4 py-3 text-sm font-black text-[#1f271b] transition hover:border-[#246b3d] hover:text-[#246b3d]"
              >
                <Download className="h-4 w-4" />
                {brochure.label}
              </a>
            ))}
          </div>
        </div>

        <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap gap-5 text-sm font-black text-[#645640]">
          <Link href="/pricing" className="hover:text-[#246b3d]">
            Pricing
          </Link>
          <Link href="/support" className="hover:text-[#246b3d]">
            Support
          </Link>
          <Link href="/terms-and-conditions" className="hover:text-[#246b3d]">
            Terms
          </Link>
          <Link href="/privacy-policy" className="hover:text-[#246b3d]">
            Privacy
          </Link>
        </footer>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#c9bb96] bg-[#fbf5e7]/96 px-3 py-3 shadow-[0_-18px_40px_-30px_rgba(31,39,27,0.72)] backdrop-blur md:hidden">
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
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-md bg-[#0b3f2a] px-2 py-3 text-sm font-black text-white"
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
