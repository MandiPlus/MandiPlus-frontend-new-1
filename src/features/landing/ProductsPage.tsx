"use client";

import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import SiteChrome from "@/features/landing/SiteChrome";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mandiplus.customer";

const productGroups = [
  {
    id: "risk-insurance",
    title: "Risk & Insurance",
    products: [
      {
        name: "Transit Risk Insurance",
        summary:
          "Cover for delays, accidents, or spoilage when perishable goods move across states.",
      },
    ],
  },
  {
    id: "fintech",
    title: "Financial",
    products: [
      {
        name: "NBFC Credit",
        summary: "Credit lines matched to mandi auction cash flow.",
      },
      {
        name: "Working Capital",
        summary: "Short-term credit to buy inventory without payment delays.",
      },
    ],
  },
  {
    id: "logistics-tech",
    title: "Logistics & Tech",
    products: [
      {
        name: "Logistics Management",
        summary: "Truck sourcing and shipment tracking across India.",
      },
      {
        name: "Market Insights",
        summary: "Price and supply signals across APMC mandis.",
      },
    ],
  },
];

const ProductsPage = () => {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f6f8] text-[#1a1a1f]">
      <div className="mx-auto max-w-6xl px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <SiteChrome active="products" />
      </div>

      <section className="px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-[#1a1a1f] sm:text-5xl">
            Our products
          </h1>
          <p className="mt-3 text-base font-medium leading-7 text-[#6b6b76]">
            Digital tools for mandi traders — insurance, credit, logistics. Not
            groceries or commodities.
          </p>
        </div>
      </section>

      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {productGroups.map((group) => (
            <div
              key={group.id}
              id={group.id}
              className="rounded-[1.5rem] border border-[#ececf2] bg-white px-6 py-7 sm:px-8"
            >
              <h2 className="text-lg font-semibold text-[#1a1a1f]">
                {group.title}
              </h2>
              <div className="mt-4 divide-y divide-[#ececf2]">
                {group.products.map((product) => (
                  <article
                    key={product.name}
                    className="grid gap-1 py-4 md:grid-cols-[0.9fr_1.3fr] md:gap-8"
                  >
                    <h3 className="text-sm font-semibold text-[#1a1a1f]">
                      {product.name}
                    </h3>
                    <p className="text-sm font-medium leading-6 text-[#6b6b76]">
                      {product.summary}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-[#1a1a1f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7c6ee6]"
          >
            <Download className="h-4 w-4" />
            Download the app
          </a>
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[#6b6b76] hover:text-[#1a1a1f]"
          >
            Home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#17171c] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm font-semibold">
            Mandi<span className="text-[#b5a9ff]">Plus</span>
          </p>
          <div className="flex flex-wrap gap-5 text-sm font-medium text-white/55">
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
    </main>
  );
};

export default ProductsPage;
