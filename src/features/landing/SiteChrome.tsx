"use client";

import Link from "next/link";

type SiteChromeProps = {
  active?: "home" | "products";
  tone?: "light" | "dark";
};

const SiteChrome = ({ active, tone = "light" }: SiteChromeProps) => {
  const dark = tone === "dark";
  const muted = dark ? "text-white/55 hover:text-white" : "text-[#6b6b76] hover:text-[#1a1a1f]";
  const activeCls = dark ? "text-white" : "text-[#1a1a1f]";

  return (
    <header className="relative z-20 flex items-center justify-between gap-4">
      <Link
        href="/"
        className={`text-[1.35rem] font-semibold tracking-tight ${
          dark ? "text-white" : "text-[#1a1a1f]"
        }`}
        aria-label="Mandiplus home"
      >
        Mandi<span className="text-[#7c6ee6]">Plus</span>
      </Link>

      <nav className="hidden items-center gap-7 text-[0.95rem] font-medium md:flex">
        <Link
          href="/products"
          className={`transition ${active === "products" ? activeCls : muted}`}
        >
          Products
        </Link>
        <a href="/#app" className={`transition ${muted}`}>
          App
        </a>
        <Link
          href="/login"
          className="rounded-full bg-[#7c6ee6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#584ab8]"
        >
          Login
        </Link>
      </nav>

      <div className="flex items-center gap-3 md:hidden">
        <Link href="/products" className={`text-sm font-medium ${muted}`}>
          Products
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-[#7c6ee6] px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Login
        </Link>
      </div>
    </header>
  );
};

export default SiteChrome;
