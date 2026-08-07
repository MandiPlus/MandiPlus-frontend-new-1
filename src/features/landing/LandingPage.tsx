"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  Download,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import SiteChrome from "@/features/landing/SiteChrome";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mandiplus.customer";
const CALL_URL = "tel:+919900186757";

const APP_SCREENS = [
  { src: "/images/landing/app-screens/1.webp", alt: "MandiPlus app screen 1" },
  { src: "/images/landing/app-screens/2.webp", alt: "MandiPlus app screen 2" },
  { src: "/images/landing/app-screens/3.webp", alt: "MandiPlus app screen 3" },
  { src: "/images/landing/app-screens/4.webp", alt: "MandiPlus app screen 4" },
];

const features = [
  {
    id: "insurance",
    title: "Insurance",
    text: "Maal route par covered.",
    image: "/images/landing/feature-insurance-wide.png",
    alt: "Insurance — Maal route par covered.",
  },
  {
    id: "tracking",
    title: "Tracking",
    text: "Truck kahan hai — live.",
    image: "/images/landing/feature-tracking-wide.png",
    alt: "Tracking — Truck kahan hai — live.",
  },
  {
    id: "claims",
    title: "Claims",
    text: "Photo bhejo. Team sambhalegi.",
    image: "/images/landing/feature-claims-wide.png",
    alt: "Claims — Photo bhejo. Team sambhalegi.",
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

const PlayStoreIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 512 512"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l265.6-265.6L47 0zm425.2 225.6-58.9-34.1-65.7 65.7 65.7 65.7 60.1-34.1c17.9-10.4 17.9-36.8-1.2-47.2zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
  </svg>
);

const OliveLeaves = ({ flip = false }: { flip?: boolean }) => (
  <img
    src="/images/landing/olive-leaves.svg"
    alt=""
    width={28}
    height={68}
    aria-hidden="true"
    className={`h-[56px] w-[23px] shrink-0 object-contain sm:h-[64px] sm:w-[26px] ${
      flip ? "-scale-x-100" : ""
    }`}
  />
);

const HeroBadge = ({ className = "" }: { className?: string }) => (
  <div className={`inline-flex items-center gap-3 sm:gap-3.5 ${className}`}>
    <OliveLeaves />
    <p className="text-center text-[15px] font-semibold leading-[1.25] tracking-tight text-[#1a1a1f] sm:text-base">
      <span className="block">India&apos;s #1 agri tech</span>
      <span className="block">insurance app</span>
    </p>
    <OliveLeaves flip />
  </div>
);

const LandingPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [screenIndex, setScreenIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setScreenIndex((prev) => (prev + 1) % APP_SCREENS.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % features.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f8]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#7c6ee6] border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f6f8] text-[#1a1a1f]">
      {/* Mobile hero — copy on white, photo below */}
      <section className="flex min-h-[100svh] flex-col bg-[#f6f6f8] md:hidden">
        <div className="shrink-0 bg-[#f6f6f8] px-4 pb-5 pt-5">
          <SiteChrome active="home" />

          <div className="mt-6">
            <HeroBadge className="mb-7" />
            <h1 className="text-[3.15rem] font-semibold leading-[0.94] tracking-tight text-[#1a1a1f]">
              <span className="block">Risk humara.</span>
              <span className="block text-[#7c6ee6]">Munafa aapka.</span>
            </h1>
            <p className="mt-4 max-w-[17rem] text-base font-medium leading-7 text-[#4a4a55]">
              <span className="block">Insurance, tracking aur claims</span>
              <span className="block">ek app mein.</span>
            </p>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Image
            src="/images/landing/hero-mandi-bleed.png"
            alt="Mandi morning — crates, truck, and market sheds"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_58%]"
          />
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#f6f6f8] to-transparent" />
        </div>
      </section>

      {/* Desktop hero — full bleed */}
      <section className="relative isolate hidden min-h-[100svh] flex-col overflow-hidden md:flex">
        <Image
          src="/images/landing/hero-mandi-bleed.png"
          alt="Mandi morning — crates, truck, and market sheds"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-30 object-cover object-[72%_center]"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(105deg,rgba(246,246,248,0.97)_0%,rgba(246,246,248,0.88)_34%,rgba(246,246,248,0.35)_58%,rgba(246,246,248,0.08)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-b from-transparent to-[#f6f6f8]" />

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-5 lg:px-8">
          <SiteChrome active="home" />

          <div className="flex flex-1 flex-col justify-center pb-24 pt-10">
            <div className="max-w-[38rem]">
              <HeroBadge className="mb-5" />
              <h1 className="text-7xl font-semibold leading-[0.94] tracking-tight text-[#1a1a1f] lg:text-[5.2rem]">
                <span className="block">Risk humara.</span>
                <span className="block text-[#7c6ee6]">Munafa aapka.</span>
              </h1>
              <p className="mt-6 max-w-md text-xl font-medium leading-8 text-[#6b6b76]">
                <span className="block">Insurance, tracking aur claims</span>
                <span className="block">ek app mein.</span>
              </p>

              <div className="mt-8 flex flex-row items-center gap-3">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1a1f] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#7c6ee6]"
                >
                  <Download className="h-4 w-4" />
                  Download App
                </a>
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1a1a1f]/12 bg-white/70 px-6 py-3.5 text-sm font-semibold text-[#1a1a1f] backdrop-blur transition hover:bg-white"
                >
                  Products
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — editorial tabbed showcase (not 3 cards) */}
      <section id="features" className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:gap-x-3">
            {features.map((feature, index) => (
              <span key={feature.id} className="inline-flex items-center gap-x-2 sm:gap-x-3">
                <button
                  type="button"
                  onClick={() => setFeatureIndex(index)}
                  className={`text-2xl font-semibold tracking-tight transition sm:text-3xl lg:text-4xl ${
                    index === featureIndex
                      ? "text-[#1a1a1f]"
                      : "text-[#c4c4cc] hover:text-[#8a8a96]"
                  }`}
                  aria-pressed={index === featureIndex}
                >
                  {feature.title}
                </button>
                {index < features.length - 1 ? (
                  <span className="text-2xl font-semibold text-[#c4c4cc] sm:text-3xl lg:text-4xl" aria-hidden>
                    .
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          <div className="relative mt-5 flex justify-center overflow-hidden rounded-[1.5rem] bg-[#efeff3] sm:mt-8 sm:block sm:rounded-[1.75rem]">
            {/* Mobile: keep full 3:2 artwork. Desktop: earlier full-bleed height. */}
            <div className="relative aspect-[3/2] w-full max-h-[min(52svh,360px)] max-w-[min(100%,calc(min(52svh,360px)*3/2))] sm:aspect-auto sm:h-[min(64svh,580px)] sm:max-h-none sm:max-w-none lg:h-[min(68svh,620px)]">
              {features.map((feature, index) => (
                <div
                  key={feature.id}
                  id={feature.id}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === featureIndex ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 1152px"
                    className="object-contain object-center sm:object-cover"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>

            <div className="absolute bottom-4 right-4 flex gap-1.5 sm:bottom-5 sm:right-5">
              {features.map((feature, index) => (
                <button
                  key={`${feature.id}-dot`}
                  type="button"
                  aria-label={`Show ${feature.title}`}
                  onClick={() => setFeatureIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === featureIndex
                      ? "w-6 bg-[#1a1a1f]/70"
                      : "w-1.5 bg-[#1a1a1f]/25 hover:bg-[#1a1a1f]/45"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* App showcase — ACKO-inspired, MandiPlus content */}
      <section id="app" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1f] sm:text-3xl">
            Explore all helpful services on our app
          </h2>
          <p className="mt-2 text-base font-medium text-[#6b6b76]">
            Load details, insurance, tracking, claims
          </p>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1a1f] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#7c6ee6]"
          >
            <PlayStoreIcon className="h-4 w-4" />
            Download the app
          </a>
        </div>

        <div className="relative mx-auto mt-8 max-w-6xl sm:mt-12 lg:mt-16">
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_240px_1fr] lg:gap-6">
            {/* Left panel — below phone on mobile */}
            <div className="relative order-2 overflow-hidden rounded-[1.5rem] bg-white p-5 sm:p-6 lg:order-1">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(124,110,230,0.12),transparent_70%)]" />
              <h3 className="relative text-lg font-semibold text-[#1a1a1f]">
                Insurance for every load
              </h3>
              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <AppTile icon={FileText} label="Load details" />
                <AppTile icon={ShieldCheck} label="Route cover" />
                <AppTile icon={FileText} label="Policy papers" active />
                <div className="relative min-h-[7.5rem] overflow-hidden rounded-2xl bg-[#f0f0f4]">
                  <Image
                    src="/images/landing/feature-insurance.png"
                    alt="Transit insurance"
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Phone carousel — directly under Download on mobile */}
            <div className="relative z-10 order-1 mx-auto w-[240px] shrink-0 justify-self-center lg:order-2 lg:self-center">
              <div className="relative h-[470px] w-[240px] overflow-hidden rounded-[2rem] border-[6px] border-[#1a1a1f] bg-[#eeeafc] shadow-[0_28px_60px_-28px_rgba(26,26,31,0.55)] lg:-my-10">
                {APP_SCREENS.map((screen, index) => (
                  <Image
                    key={screen.src}
                    src={screen.src}
                    alt={screen.alt}
                    fill
                    sizes="240px"
                    priority={index === 0}
                    unoptimized
                    className={`object-cover object-top transition-opacity duration-500 ${
                      index === screenIndex ? "z-10 opacity-100" : "z-0 opacity-0"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="relative order-3 overflow-hidden rounded-[1.5rem] bg-white p-5 sm:p-6">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(133,182,61,0.10),transparent_70%)]" />
              <h3 className="relative text-lg font-semibold text-[#1a1a1f]">
                Tracking & claims
              </h3>
              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <AppTile icon={MapPin} label="Live truck map" />
                <AppTile icon={Truck} label="Trip updates" />
                <div className="relative min-h-[7.5rem] overflow-hidden rounded-2xl bg-[#f0f0f4]">
                  <Image
                    src="/images/landing/feature-claims.png"
                    alt="Claims"
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </div>
                <AppTile icon={Camera} label="Photo claim" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brochures */}
      <section id="brochure" className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-[1.5rem] border border-[#ececf2] bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <h2 className="text-base font-semibold text-[#1a1a1f]">Brochures</h2>
          <div className="flex flex-wrap gap-2">
            {brochures.map((brochure) => (
              <a
                key={brochure.href}
                href={brochure.href}
                className="inline-flex items-center gap-2 rounded-full border border-[#e8e8ee] px-4 py-2 text-sm font-medium text-[#1a1a1f] transition hover:border-[#cfc8f0]"
              >
                <Download className="h-3.5 w-3.5" />
                {brochure.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-4 bg-[#17171c] pb-24 text-white md:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-tight">
              Mandi<span className="text-[#b5a9ff]">Plus</span>
            </p>
            <p className="mt-2 max-w-xs text-xs font-medium text-white/40">
              B2B insurance, tracking & claims for mandi trade.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-white/55">
            <Link href="/products" className="hover:text-white">
              Products
            </Link>
            <Link href="/pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/support" className="hover:text-white">
              Support
            </Link>
            <Link href="/privacy-policy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms-and-conditions" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/40 bg-white/55 px-3 py-3 backdrop-blur-xl md:hidden supports-[backdrop-filter]:bg-white/45">
        <div className="mx-auto grid w-full max-w-[22rem] grid-cols-2 gap-2">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-[#1a1a1f] px-2 py-3 text-sm font-semibold text-white"
          >
            <PlayStoreIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Download</span>
          </a>
          <a
            href={CALL_URL}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#e8e8ee]/80 bg-white/70 px-2 py-3 text-sm font-semibold text-[#1a1a1f] backdrop-blur-md"
          >
            <Phone className="h-4 w-4 shrink-0" />
            <span className="truncate">Call</span>
          </a>
        </div>
      </div>
    </main>
  );
};

function AppTile({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof FileText;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl bg-[#f6f6f8] p-3.5 ${
        active ? "ring-1 ring-[#7c6ee6]/45" : ""
      }`}
    >
      <Icon className="h-5 w-5 text-[#1a1a1f]" strokeWidth={1.75} />
      <p className="text-sm font-medium leading-5 text-[#1a1a1f]">{label}</p>
    </div>
  );
}

export default LandingPage;
