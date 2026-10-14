import type { Metadata } from "next";
import Image from "next/image";
import { fetchPosReleases } from "@/features/pos-app/releases";

export const metadata: Metadata = {
  title: "Mandi Plus POS — Download",
  description: "Mandi Plus POS Android app download karein.",
};

// The version shown follows release.sh on its own: the page is rebuilt from mandipos-api at most
// once a minute (Next needs a literal here), and the download link always serves the newest build.
export const revalidate = 60;

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PosAppPage() {
  const pos = (await fetchPosReleases())?.pos;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center font-[family-name:var(--font-manrope)]">
      <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200">
        <Image src="/images/pos-app/mark.png" alt="" width={120} height={120} className="h-full w-full scale-150 object-cover" priority />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Mandi Plus POS</h1>

      <a
        href="/pos-app/download"
        className="mt-8 w-full max-w-xs rounded-2xl bg-[#4309ac] px-6 py-4 text-lg font-bold text-white transition hover:bg-[#350889]"
      >
        Download App
      </a>
      <p className="mt-3 text-sm text-slate-500">
        {pos ? `Version ${pos.versionName} · ${formatSize(pos.sizeBytes)} · Android` : "Android"}
      </p>
    </main>
  );
}
