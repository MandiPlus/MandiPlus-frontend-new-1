"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import styles from "@/features/landing/LandingPage.module.css";
import { COMPANY_INFO } from "@/features/landing/landingData";

type SiteChromeProps = {
  active?: "home" | "products";
};

const navItems = [
  { label: "Products", href: "/products", id: "products" },
];

const SiteChrome = ({ active }: SiteChromeProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.siteHeader}>
      <Link href="/" className={styles.logo} aria-label="MandiPlus home">
        Mandi<span className={styles.logoPlus}>Plus</span>
      </Link>

      <nav className={styles.desktopNav} aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`${styles.navLink} ${
              item.id === active ? styles.navActive : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.headerActions}>
        <Link href="/login" className={styles.loginLink}>
          Login
        </Link>
        <a href={COMPANY_INFO.phoneHref} className={styles.headerCta}>
          Contact us
        </a>
      </div>

      <button
        type="button"
        className={styles.menuButton}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {menuOpen ? (
        <nav
          id="mobile-navigation"
          className={styles.mobileMenu}
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={styles.mobileNavLink}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
          <Link
            href="/login"
            className={styles.mobileNavLink}
            onClick={() => setMenuOpen(false)}
          >
            Login
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <a
            href={COMPANY_INFO.phoneHref}
            className={styles.mobileNavLink}
            onClick={() => setMenuOpen(false)}
          >
            Contact us
          </a>
        </nav>
      ) : null}
    </header>
  );
};

export default SiteChrome;
