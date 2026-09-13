import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow an isolated local-test build to run alongside the normal dev server.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  async redirects() {
    return [
      {
        // Older app builds link to the PDF path; the MOU now lives on a page.
        source: "/docs/mou.pdf",
        destination: "/docs/mou",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
