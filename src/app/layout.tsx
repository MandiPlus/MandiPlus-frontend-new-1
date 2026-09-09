import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Geist,
  Geist_Mono,
  Manrope,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import "./globals.css";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "@/features/auth/context/AuthContext";
import ConsentGuard from "@/shared/components/ConsentGuard";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import InstallPrompt from "@/components/InstallPrompt";
import { APP_STORE_ID } from "@/features/landing/landingData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: "700",
  preload: false,
});

const notoKannada = Noto_Sans_Kannada({
  variable: "--font-noto-kannada",
  subsets: ["kannada"],
  weight: "700",
  preload: false,
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-noto-gurmukhi",
  subsets: ["gurmukhi"],
  weight: "700",
  preload: false,
});

const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati"],
  weight: "700",
  preload: false,
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
  weight: "700",
  preload: false,
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-telugu",
  subsets: ["telugu"],
  weight: "700",
  preload: false,
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: "700",
  preload: false,
});

/**
 * Runs before the first paint, so the download buttons are already correct on the very first
 * frame — no flash of the wrong store, and the page stays statically cached because nothing is
 * decided from the User-Agent on the server.
 *
 * iPadOS is the catch: since iPadOS 13 an iPad reports itself as "Macintosh" and its
 * navigator.platform is "MacIntel", exactly like a desktop Mac. Touch points are what separate
 * them — a Mac reports 0/1, an iPad reports 5. Anything not identified as iOS falls through to
 * the Play Store, which is also what a visitor with scripting disabled gets.
 */
const OS_PROBE = `(function(){try{var n=navigator,u=n.userAgent||"";if(/iPad|iPhone|iPod/.test(u)||(/Mac/.test(u)&&n.maxTouchPoints>1))document.documentElement.setAttribute("data-os","ios")}catch(e){}})()`;

export const metadata: Metadata = {
  title: "MandiPlus",
  description:
    "Cover, track and manage every mandi load from dispatch to settlement with MandiPlus.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MandiPlus",
  },
  // Safari's native Smart App Banner; costs nothing and outranks anything we could draw.
  other: { "apple-itunes-app": `app-id=${APP_STORE_ID}` },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#4309ac',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: OS_PROBE }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/images/truck-marker.svg" as="image" type="image/svg+xml" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${bricolage.variable} ${notoDevanagari.variable} ${notoKannada.variable} ${notoGurmukhi.variable} ${notoGujarati.variable} ${notoTamil.variable} ${notoTelugu.variable} ${notoBengali.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <AuthProvider>
          <ConsentGuard>
            {children}
            <InstallPrompt />
            <ToastContainer />
          </ConsentGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
