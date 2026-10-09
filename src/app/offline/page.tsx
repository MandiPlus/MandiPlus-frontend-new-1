"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-[#e0d7fc] flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-[#4309ac]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072"
          />
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>

      <h1
        className="text-2xl font-bold text-slate-800 mb-2"
        style={{ fontFamily: "Poppins, sans-serif" }}
      >
        You&apos;re Offline
      </h1>

      <p className="text-gray-600 mb-8 max-w-sm">
        No internet connection. Please check your network and try again.
        Your data is safe and will sync when you&apos;re back online.
      </p>

      <button
        onClick={() => typeof window !== "undefined" && window.location.reload()}
        className="bg-[#4309ac] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#350889] transition-colors"
      >
        Try Again
      </button>

      <p className="mt-12 text-xs text-gray-400">
        <span className="text-slate-800 font-semibold">Mandi</span>
        <span className="text-[#4309ac] font-semibold">Plus</span>
        {" "}&mdash; Risk Humara, Munafa Aapka
      </p>
    </div>
  );
}
