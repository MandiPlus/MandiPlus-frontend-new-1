import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { fetchPosReleases, type PosRelease } from "@/features/pos-app/releases";

export const metadata: Metadata = {
  title: "Mandi Plus POS — Android app download",
  description:
    "Mandi ki dukaan ke liye billing app: slip, udhaar, daybook aur printer. Naya version yahan se download karein.",
  openGraph: {
    title: "Mandi Plus POS — Android app",
    description: "Dukaan ki billing, udhaar aur hisaab — ek app mein. Download karein.",
  },
};

// The version shown follows release.sh on its own: the page is rebuilt from mandipos-api at most
// once a minute (Next needs a literal here), and the download link always serves the newest build.
export const revalidate = 60;

const PAGE_URL = "https://mandiplus.com/pos-app";
const POS_DOWNLOAD = "/pos-app/download";
const DAYBOOK_DOWNLOAD = "/pos-app/download?app=daybook";

const FEATURES = [
  { title: "Slip aur billing", body: "Har grahak ki slip turant, 2, 3 ya 4 inch printer par." },
  { title: "Udhaar ka hisaab", body: "Kis grahak ka kitna baaki hai, ek nazar mein." },
  { title: "Daybook", body: "Din ka cash, UPI aur kharcha — sab apne aap judta hai." },
  { title: "Bina internet bhi", body: "Net chala jaye to bhi kaam chalta rahe, baad mein sync." },
];

const STEPS = [
  {
    title: "Download karein",
    body: "Upar wala button dabayein. Chrome “file harmful ho sakti hai” pooche to “Download anyway” chunein.",
  },
  {
    title: "File kholein",
    body: "Download poora hone par file par tap karein. Phone “Install unknown apps” maange to Chrome ke liye “Allow” karein.",
  },
  {
    title: "Install karke login",
    body: "Install dabayein, phir apne mobile number aur OTP se login karein.",
  },
];

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function releaseLine(r: PosRelease | null | undefined) {
  if (!r) return "Naya version · Android 6 ya usse upar";
  return `Version ${r.versionName} · ${formatSize(r.sizeBytes)} · ${formatDate(r.publishedAt)}`;
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14" />
    </svg>
  );
}

export default async function PosAppPage() {
  const [releases, qrSvg] = await Promise.all([
    fetchPosReleases(),
    QRCode.toString(PAGE_URL, { type: "svg", margin: 0, color: { dark: "#1c1530", light: "#0000" } }),
  ]);
  const pos = releases?.pos;
  const daybook = releases?.daybook;
  const notes = pos?.notes?.trim();

  return (
    <div className="min-h-screen bg-[#f5f2ff] text-slate-800 font-[family-name:var(--font-manrope)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">
          Mandi<span className="text-[#4309ac]">Plus</span>
        </Link>
        <a href="tel:+919606995351" className="text-sm font-semibold text-[#4309ac] hover:underline">
          Madad: 96069 95351
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {/* Hero */}
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4309ac] to-[#2a0670] text-white shadow-[0_20px_60px_-25px_rgba(67,9,172,0.6)]">
          <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
                  <Image src="/images/pos-app/mark.png" alt="" width={96} height={96} className="h-[150%] w-[150%] max-w-none object-cover" priority />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Android app</p>
                  <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl font-[family-name:var(--font-bricolage)]">
                    Mandi Plus POS
                  </h1>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
                Dukaan ki billing, udhaar aur hisaab — ek app mein. Mandi ki aadhat aur dukaan ke liye bana.
              </p>

              <a
                href={POS_DOWNLOAD}
                className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-lg font-bold text-[#4309ac] shadow-lg transition hover:bg-[#f0eaff] active:scale-[0.99] sm:w-auto"
              >
                <DownloadIcon className="h-6 w-6" />
                App download karein
              </a>
              <p className="mt-3 text-sm text-white/75">{releaseLine(pos)}</p>
              <p className="mt-1 text-xs text-white/60">
                Ek baar install karne ke baad app khud update hota rehta hai.
              </p>
            </div>

            {/* On a laptop the phone is the one that needs the app: hand it over by QR. */}
            <div className="hidden flex-col items-center rounded-3xl bg-white p-5 text-center text-slate-700 md:flex">
              <div className="h-40 w-40" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-3 text-sm font-bold text-slate-900">Phone ke camera se scan karein</p>
              <p className="text-xs text-slate-500">mandiplus.com/pos-app</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#e4dcfb] bg-white p-5">
              <h2 className="font-bold text-slate-900">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* How to install */}
          <section className="rounded-3xl border border-[#e4dcfb] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-extrabold text-slate-900">Install kaise karein</h2>
            <ol className="mt-5 space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4309ac] text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{s.title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 rounded-xl bg-[#f5f2ff] px-4 py-3 text-sm text-slate-600">
              Yeh app Play Store par nahi hai, isliye phone ek baar permission maangta hai. App MandiPlus ki
              official key se signed hai.
            </p>
          </section>

          <div className="space-y-6">
            {notes && (
              <section className="rounded-3xl border border-[#e4dcfb] bg-white p-6">
                <h2 className="text-lg font-extrabold text-slate-900">Is version mein naya</h2>
                <p className="mt-1 text-xs font-semibold text-[#4309ac]">{pos ? `Version ${pos.versionName}` : null}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{notes}</p>
              </section>
            )}

            {/* The owner's companion app */}
            <section className="rounded-3xl bg-[#203044] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Malik ke liye</p>
              <h2 className="mt-1 text-lg font-extrabold">Daybook app</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Ghar se dukaan ka hisaab dekhein — galla, udhaar aur din ki report. Usi login se chalta hai.
              </p>
              <a
                href={DAYBOOK_DOWNLOAD}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#203044] transition hover:bg-slate-100"
              >
                <DownloadIcon className="h-5 w-5" />
                Daybook download karein
              </a>
              <p className="mt-2 text-xs text-white/60">{releaseLine(daybook)}</p>
            </section>
          </div>
        </div>

        {pos && (
          <details className="mt-8 text-xs text-slate-500">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <p className="mt-2 break-all">
              POS {pos.versionName} (build {pos.versionCode}) SHA-256: <code>{pos.sha256}</code>
            </p>
            {daybook && (
              <p className="mt-1 break-all">
                Daybook {daybook.versionName} (build {daybook.versionCode}) SHA-256: <code>{daybook.sha256}</code>
              </p>
            )}
          </details>
        )}
      </main>
    </div>
  );
}
