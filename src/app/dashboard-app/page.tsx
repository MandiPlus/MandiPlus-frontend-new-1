import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "MandiPlus Dashboard — Windows",
  description: "Dukaan ka hisab-kitab computer par. Windows ke liye MandiPlus Dashboard.",
};

// The link always serves the newest build, and the app updates itself, so this page never changes.
export default function DashboardAppPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center font-[family-name:var(--font-manrope)]">
      <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200">
        <Image src="/images/pos-app/mark.png" alt="" width={120} height={120} className="h-full w-full scale-150 object-cover" priority />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-slate-900">MandiPlus Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">Windows</p>

      <a
        href="/dashboard-app/download"
        className="mt-8 w-full max-w-xs rounded-2xl bg-[#4309ac] px-6 py-4 text-lg font-bold text-white transition hover:bg-[#350889]"
      >
        Download
      </a>
    </main>
  );
}
