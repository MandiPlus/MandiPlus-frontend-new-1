"use client";

import { useRouter } from "next/navigation";

export default function AdminSessionExpiredPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Admin Session Expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your admin session has expired. Please login again.
        </p>
        <button
          onClick={() => router.push("/admin/login")}
          className="mt-5 rounded-lg bg-[#4309ac] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#360988]"
        >
          Login Again
        </button>
      </div>
    </main>
  );
}
