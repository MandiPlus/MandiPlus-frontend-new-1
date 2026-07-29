"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  FilePlus2,
  HelpCircle,
  Menu,
  ShieldCheck,
  Truck,
  WalletCards,
} from "lucide-react";

import { CustomerAppShell, useCustomerAppShell } from "./CustomerAppShell";
import { ChannelPartnerRequestModal } from "./ChannelPartnerRequestModal";
import { useCustomerAppData } from "./useCustomerAppData";
import {
  getInsuranceUrl,
  isCheckoutReady,
  isClosedClaim,
  isPayableInvoice,
} from "./utils";
import styles from "./customer-app.module.css";

export default function CustomerHomePage() {
  const data = useCustomerAppData();

  return (
    <CustomerAppShell
      activeTab="home"
      partnerActive={data.partnerActive}
      home
    >
      <HomeContent data={data} />
    </CustomerAppShell>
  );
}

function HomeContent({ data }: { data: ReturnType<typeof useCustomerAppData> }) {
  const { openMenu } = useCustomerAppShell();
  const [partnerRequestOpen, setPartnerRequestOpen] = useState(false);
  const pending = data.invoices.filter(
    (invoice) => isPayableInvoice(invoice) && isCheckoutReady(invoice),
  );
  const policies = data.invoices.filter((invoice) => Boolean(getInsuranceUrl(invoice)));
  const activeClaims = data.claims.filter((claim) => !isClosedClaim(claim));

  return (
    <>
      <section className={styles.hero}>
        <Image
          src="/customer-app/home-risk-header.webp"
          alt="Risk Humara, Munafa Aapka"
          fill
          sizes="(max-width: 1023px) 100vw, 480px"
          priority
          className={styles.heroImage}
        />
        <div className={styles.heroBar}>
          <button
            type="button"
            className={styles.heroButton}
            onClick={openMenu}
            aria-label="Open profile menu"
          >
            <Menu size={23} strokeWidth={2.4} />
          </button>
          <h1 className={styles.heroTitle}>Mandi Plus</h1>
          <Link
            href="/support"
            className={styles.heroButton}
            aria-label="Open help"
          >
            <HelpCircle size={24} strokeWidth={2.2} />
          </Link>
        </div>
      </section>

      <section className={styles.quickSheet}>
        <div className={styles.sheetHandle} />
        {data.error ? (
          <div className={styles.errorBox}>
            {data.error}{" "}
            <button type="button" onClick={() => void data.refresh()} style={{ fontWeight: 900 }}>
              Retry
            </button>
          </div>
        ) : null}

        <Link href="/insurance" className={styles.createCard}>
          <span className={styles.createIcon}>
            <FilePlus2 size={28} strokeWidth={2.15} />
          </span>
          <span className={styles.createTitle}>Insurance banao</span>
        </Link>

        <div className={styles.actionGrid}>
          <HomeAction
            href="/pay"
            icon={WalletCards}
            title="Payments"
            sub={
              pending.length ? `${pending.length} due` : ""
            }
            tone="blue"
          />
          <HomeAction
            href="/insurance-dekho"
            icon={ShieldCheck}
            title="Insurance dekho!"
            sub={
              policies.length ? `${policies.length} issued` : ""
            }
            tone="purple"
          />
          <HomeAction
            href="/claims"
            icon={ShieldCheck}
            title="Claims"
            sub={
              activeClaims.length ? `${activeClaims.length} active` : ""
            }
            tone="amber"
          />
          <HomeAction
            href="/tracking"
            icon={Truck}
            title="Tracking"
            sub=""
            tone="navy"
          />
        </div>

        <div className={styles.promoStack}>
          <Link
            href="/customer/wallet"
            className={styles.promoCard}
            aria-label="Open wallet limit offer"
          >
            <Image
              src="/customer-app/adbanner.webp"
              alt="Mandi Plus wallet offer"
              width={1578}
              height={996}
              sizes="(max-width: 1023px) 100vw, 444px"
            />
          </Link>
          {data.partnerActive ? (
            <Link
              href="/partner"
              className={styles.promoCard}
              aria-label="Open partner portal"
            >
              <Image
                src="/customer-app/channel-partner-ad.webp"
                alt="Mandi Plus partner"
                width={1578}
                height={996}
                sizes="(max-width: 1023px) 100vw, 444px"
              />
            </Link>
          ) : (
            <button
              type="button"
              className={styles.promoCard}
              aria-label="Become a Mandi Plus partner"
              onClick={() => setPartnerRequestOpen(true)}
            >
              <Image
                src="/customer-app/channel-partner-ad.webp"
                alt="Mandi Plus partner"
                width={1578}
                height={996}
                sizes="(max-width: 1023px) 100vw, 444px"
              />
            </button>
          )}
        </div>
      </section>
      <ChannelPartnerRequestModal
        open={partnerRequestOpen}
        onClose={() => setPartnerRequestOpen(false)}
        onSubmitted={() => data.refresh(true)}
      />
    </>
  );
}

function HomeAction({
  href,
  icon: Icon,
  title,
  sub,
  tone,
}: {
  href: string;
  icon: typeof WalletCards;
  title: string;
  sub: string;
  tone: "blue" | "purple" | "amber" | "navy";
}) {
  const toneClass =
    tone === "blue"
      ? styles.toneBlue
      : tone === "amber"
        ? styles.toneAmber
        : tone === "purple"
          ? styles.tonePurple
          : styles.toneNavy;

  return (
    <Link href={href} className={styles.actionCard}>
      <span className={`${styles.actionIcon} ${toneClass}`}>
        <Icon size={25} strokeWidth={2.1} />
      </span>
      <span>
        <span className={styles.actionTitle}>{title}</span>
        {sub ? <span className={styles.actionSub}>{sub}</span> : null}
      </span>
    </Link>
  );
}
