"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  Youtube,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import SiteChrome from "@/features/landing/SiteChrome";
import styles from "@/features/landing/LandingPage.module.css";
import {
  CALL_URL,
  COMPANY_INFO,
  PLAY_STORE_URL,
  SOCIAL_LINKS,
} from "@/features/landing/landingData";

const profitTranslations = [
  { lang: "hi", text: "मुनाफ़ा आपका।" },
  { lang: "kn", text: "ಲಾಭ ನಿಮ್ಮದು." },
  { lang: "mr", text: "नफा तुमचा." },
  { lang: "pa", text: "ਮੁਨਾਫ਼ਾ ਤੁਹਾਡਾ।" },
  { lang: "gu", text: "નફો તમારો." },
  { lang: "ta", text: "லாபம் உங்களுக்கே." },
  { lang: "te", text: "లాభం మీదే." },
  { lang: "bn", text: "লাভ আপনার।" },
];

const featureShowcase = [
  {
    id: "insurance",
    name: "Insurance",
    subtitle: "Maal route par covered.",
    wideImage: "/images/landing/feature-insurance-wide.png",
    mobileImage: "/images/landing/feature-insurance.png",
    alt: "A produce truck and policy showing insurance cover for a mandi load",
  },
  {
    id: "tracking",
    name: "Tracking",
    subtitle: "Truck kahan hai — live.",
    wideImage: "/images/landing/feature-tracking-wide.png",
    mobileImage: "/images/landing/feature-tracking-mobile-safe.png",
    alt: "A live truck route shown in the MandiPlus app",
  },
  {
    id: "claims",
    name: "Claims",
    subtitle: "Photo bhejo. Team sambhalegi.",
    wideImage: "/images/landing/feature-claims-wide.png",
    mobileImage: "/images/landing/feature-claims.png",
    alt: "A mandi trader photographing damaged produce for claim support",
  },
] as const;

const appPreviewScreens = [
  {
    id: "insurance",
    src: "/images/landing/app-screens/4.webp",
    alt: "Insurance records and payments inside the MandiPlus app",
  },
  {
    id: "home",
    src: "/images/landing/app-screens/2.webp",
    alt: "MandiPlus app home with insurance, payments, claims and tracking",
  },
  {
    id: "tracking",
    src: "/images/landing/app-screens/3.webp",
    alt: "Live vehicle tracking inside the MandiPlus app",
  },
  {
    id: "cover",
    src: "/images/landing/app-screens/1.webp",
    alt: "MandiPlus trip insurance, vehicle tracking and claims support",
  },
] as const;

const PlayStoreIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    viewBox="0 0 512 512"
    aria-hidden="true"
    width={size}
    height={size}
    fill="currentColor"
  >
    <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l265.6-265.6L47 0zm425.2 225.6-58.9-34.1-65.7 65.7 65.7 65.7 60.1-34.1c17.9-10.4 17.9-36.8-1.2-47.2zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
  </svg>
);

const FooterSocialIcon = ({ id }: { id: string }) => {
  const props = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

  switch (id) {
    case "instagram":
      return <Instagram {...props} />;
    case "linkedin":
      return <Linkedin {...props} />;
    case "youtube":
      return <Youtube {...props} />;
    case "facebook":
      return <Facebook {...props} />;
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden="true"
          fill="none"
        >
          <path
            d="M5 4 19 20M19 4 5 20"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
};

const HeroBadge = () => (
  <div className={styles.heroBadge}>
    <Image
      src="/images/landing/olive-leaves.svg"
      alt=""
      width={28}
      height={68}
      aria-hidden="true"
      className={styles.heroBadgeLeaves}
    />
    <p>
      India&apos;s #1 agri tech
      <span>insurance app</span>
    </p>
    <Image
      src="/images/landing/olive-leaves.svg"
      alt=""
      width={28}
      height={68}
      aria-hidden="true"
      className={`${styles.heroBadgeLeaves} ${styles.heroBadgeLeavesFlipped}`}
    />
  </div>
);

const LandingPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeFeature, setActiveFeature] = useState(0);
  const [featureCycleKey, setFeatureCycleKey] = useState(0);
  const [activeAppScreen, setActiveAppScreen] = useState(0);
  const [translationIndex, setTranslationIndex] = useState(0);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const heroCtaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setTranslationIndex(
        (current) => (current + 1) % profitTranslations.length,
      );
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveFeature((current) => (current + 1) % featureShowcase.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [featureCycleKey]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveAppScreen(
        (current) => (current + 1) % appPreviewScreens.length,
      );
    }, 2400);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading || user || !heroCtaRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowMobileBar(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: 0.2 },
    );

    observer.observe(heroCtaRef.current);
    return () => observer.disconnect();
  }, [loading, user]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#5a36cf] border-t-transparent" />
      </div>
    );
  }

  const selectFeature = (index: number) => {
    setActiveFeature(index);
    setFeatureCycleKey((current) => current + 1);
  };

  return (
    <main className={styles.site}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <SiteChrome active="home" />

          <div className={styles.heroGrid}>
            <div className={styles.heroCopyColumn}>
              <HeroBadge />
              <h1 className={styles.heroTitle}>
                <span>Risk humara.</span>
                <span className="sr-only"> Munafa aapka.</span>
                <span className={styles.rotatingLine} aria-hidden="true">
                  <span
                    key={profitTranslations[translationIndex].lang}
                    lang={profitTranslations[translationIndex].lang}
                    className={styles.rotatingText}
                  >
                    {profitTranslations[translationIndex].text}
                  </span>
                </span>
              </h1>

              <div
                className={styles.claimProof}
                aria-label="₹1 crore plus worth of claims covered"
              >
                <ShieldCheck size={19} strokeWidth={2} aria-hidden="true" />
                <strong>₹1 Cr+</strong>
                <span className={styles.claimProofLabel}>
                  worth of claims covered
                </span>
              </div>

              <div className={styles.heroActions}>
                <a
                  ref={heroCtaRef}
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryCta}
                >
                  <PlayStoreIcon />
                  Get the app
                </a>
                <Link href="/login" className={styles.heroLogin}>
                  Login
                </Link>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Image
                src="/images/landing/hero-claim-received-bgmatch.webp"
                alt="A MandiPlus trader showing a successful claim status to two fellow mandi users"
                fill
                priority
                sizes="(max-width: 800px) 92vw, (max-width: 1200px) 52vw, 650px"
                className={`${styles.heroIllustration} ${styles.heroIllustrationDesktop}`}
              />
              <Image
                src="/images/landing/hero-claim-received-mobile-bgmatch.webp"
                alt="A MandiPlus trader showing a successful claim status to two fellow mandi users"
                fill
                priority
                sizes="100vw"
                className={`${styles.heroIllustration} ${styles.heroIllustrationMobile}`}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="products" className={styles.showcaseSection}>
        <div className={`${styles.container} ${styles.showcaseContainer}`}>
          <div
            className={styles.showcaseTabs}
            role="tablist"
            aria-label="MandiPlus services"
          >
            {featureShowcase.map((feature, index) => (
              <span key={feature.id} className={styles.showcaseTabItem}>
                {index > 0 ? (
                  <span className={styles.showcaseSeparator} aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFeature === index}
                  aria-controls="feature-showcase-panel"
                  className={`${styles.showcaseTab} ${
                    activeFeature === index ? styles.showcaseTabActive : ""
                  }`}
                  onClick={() => selectFeature(index)}
                >
                  {feature.name}
                </button>
              </span>
            ))}
          </div>

          <div
            id="feature-showcase-panel"
            role="tabpanel"
            className={styles.showcaseFrame}
            aria-live="polite"
          >
            {featureShowcase.map((feature, index) => {
              const relativePosition =
                (index - activeFeature + featureShowcase.length) %
                featureShowcase.length;
              const positionClass =
                relativePosition === 0
                  ? styles.showcaseSlideActive
                  : relativePosition === 1
                    ? styles.showcaseSlideNext
                    : styles.showcaseSlidePrevious;

              return (
                <div
                  key={feature.id}
                  className={`${styles.showcaseSlide} ${positionClass}`}
                  aria-hidden={activeFeature !== index}
                >
                  <div className={styles.showcaseMobileCopy}>
                    <h2>{feature.name}</h2>
                    <p>{feature.subtitle}</p>
                  </div>

                  <Image
                    src={feature.wideImage}
                    alt={activeFeature === index ? feature.alt : ""}
                    fill
                    sizes="(max-width: 760px) 0px, min(100vw - 48px, 1240px)"
                    className={`${styles.showcaseImage} ${styles.showcaseImageWide}`}
                  />
                  <Image
                    src={feature.mobileImage}
                    alt={activeFeature === index ? feature.alt : ""}
                    fill
                    sizes="(max-width: 760px) calc(100vw - 40px), 0px"
                    className={`${styles.showcaseImage} ${styles.showcaseImageMobile}`}
                  />
                </div>
              );
            })}

            <div className={styles.showcaseDots} aria-label="Choose a service">
              {featureShowcase.map((feature, index) => (
                <button
                  key={feature.id}
                  type="button"
                  className={`${styles.showcaseDot} ${
                    activeFeature === index ? styles.showcaseDotActive : ""
                  }`}
                  onClick={() => selectFeature(index)}
                  aria-label={`Show ${feature.name}`}
                  aria-current={activeFeature === index ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.servicesSection}>
        <div className={`${styles.container} ${styles.servicesContainer}`}>
          <header className={styles.servicesHeader}>
            <h2 className={styles.servicesTitle}>
              Explore all helpful services on our app
            </h2>
            <p className={styles.servicesSubtitle}>
              Load details, insurance, tracking, claims
            </p>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.servicesCta}
            >
              <PlayStoreIcon size={16} />
              Download the app
            </a>
          </header>

          <div className={styles.servicesStage}>
            <ServicePanel
              title="Insurance for every load"
              items={[
                { label: "Load details", icon: <FileText size={21} /> },
                { label: "Route cover", icon: <ShieldCheck size={21} /> },
                { label: "Policy papers", icon: <FileText size={21} /> },
                {
                  label: "",
                  image: "/images/landing/feature-insurance.png",
                  imageAlt: "A covered mandi produce load",
                },
              ]}
            />

            <div
              className={styles.servicesPhone}
              role="region"
              aria-roledescription="carousel"
              aria-label="MandiPlus app preview"
            >
              {appPreviewScreens.map((screen, index) => {
                const relativePosition =
                  (index - activeAppScreen + appPreviewScreens.length) %
                  appPreviewScreens.length;
                const positionClass =
                  relativePosition === 0
                    ? styles.servicesPhoneSlideActive
                    : relativePosition === 1
                      ? styles.servicesPhoneSlideNext
                      : styles.servicesPhoneSlidePrevious;

                return (
                  <div
                    key={screen.id}
                    className={`${styles.servicesPhoneSlide} ${positionClass}`}
                    aria-hidden={activeAppScreen !== index}
                  >
                    <Image
                      src={screen.src}
                      alt={activeAppScreen === index ? screen.alt : ""}
                      fill
                      sizes="300px"
                      className={styles.servicesPhoneImage}
                    />
                  </div>
                );
              })}

            </div>

            <ServicePanel
              title="Tracking & claims"
              items={[
                { label: "Live truck map", icon: <MapPin size={21} /> },
                { label: "Trip updates", icon: <Truck size={21} /> },
                {
                  label: "",
                  image: "/images/landing/feature-claims.png",
                  imageAlt: "Photo-led produce claim support",
                },
                { label: "Photo claim", icon: <Camera size={21} /> },
              ]}
            />
          </div>
        </div>
      </section>

      <SiteFooter />

      {showMobileBar ? (
        <div className={styles.mobileBar}>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            <PlayStoreIcon size={14} /> Get the app
          </a>
          <a href={CALL_URL}>
            <Phone size={14} aria-hidden="true" /> Contact us
          </a>
        </div>
      ) : null}
    </main>
  );
};

type ServicePanelItem = {
  label: string;
  icon?: React.ReactNode;
  image?: string;
  imageAlt?: string;
};

function ServicePanel({
  title,
  items,
}: {
  title: string;
  items: ServicePanelItem[];
}) {
  return (
    <article className={styles.servicePanel}>
      <h3>{title}</h3>
      <div className={styles.serviceTiles}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={`${styles.serviceTile} ${
              item.image ? styles.serviceTileImage : ""
            }`}
          >
            {item.image ? (
              <Image
                src={item.image}
                alt={item.imageAlt ?? ""}
                fill
                sizes="(max-width: 800px) 45vw, 180px"
                className={styles.serviceTileArtwork}
              />
            ) : (
              <>
                <span className={styles.serviceTileIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerMain}`}>
        <div className={styles.footerTop}>
          <div>
            <p className={styles.footerBrand}>
              Mandi<span className={styles.logoPlus}>Plus</span>
            </p>
            <p className={styles.footerCopy}>
              Insurance, tracking aur claims—mandi trade ke liye, ek jagah.
            </p>
          </div>
          <nav className={styles.footerLinks} aria-label="Footer navigation">
            <Link href="/products" className={styles.footerLink}>Products</Link>
            <Link href="/pricing" className={styles.footerLink}>Pricing</Link>
            <Link href="/support" className={styles.footerLink}>Support</Link>
            <Link href="/privacy-policy" className={styles.footerLink}>Privacy</Link>
            <Link href="/terms-and-conditions" className={styles.footerLink}>Terms</Link>
          </nav>
        </div>

        <div className={styles.footerCompanyRow}>
          <div className={styles.footerCompany}>
            <p className={styles.footerCompanyName}>
              MandiPlus is owned and operated by <strong>{COMPANY_INFO.parent}</strong>.
            </p>
            <address className={styles.footerAddress}>
              {COMPANY_INFO.address.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <a href={COMPANY_INFO.phoneHref} className={styles.footerPhone}>
              <Phone size={14} aria-hidden="true" />
              {COMPANY_INFO.phone}
            </a>
          </div>

          <div className={styles.footerSocials} aria-label="MandiPlus social links">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.id}
                href={social.href}
                className={styles.footerSocialLink}
                aria-label={social.label}
              >
                <FooterSocialIcon id={social.id} />
              </a>
            ))}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.footerDisclaimer}>
            Insurance products are subject to eligibility, policy terms,
            exclusions and insurer approval. MandiPlus facilitates access and
            claim support; it does not underwrite risk.
          </p>
          <p className={styles.footerCopyright}>
            © 2026 ENP FARMS PRIVATE LIMITED. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingPage;
