"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  FileText,
  Headphones,
  Home,
  Languages,
  LogOut,
  Menu,
  Plus,
  Route,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";
import { initials } from "./utils";
import { CustomerSetupModal } from "./CustomerSetupModal";
import styles from "./customer-app.module.css";

export type CustomerTab = "home" | "pay" | "create" | "tracking" | "partner";

type ShellContextValue = {
  openMenu: () => void;
};

const ShellContext = createContext<ShellContextValue>({ openMenu: () => undefined });

export function useCustomerAppShell() {
  return useContext(ShellContext);
}

export function CustomerAppShell({
  activeTab,
  partnerActive = false,
  showBottomNav = true,
  home = false,
  children,
}: {
  activeTab: CustomerTab;
  partnerActive?: boolean;
  showBottomNav?: boolean;
  home?: boolean;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const navItems = [
    { key: "home" as const, href: "/home", label: "Home", icon: Home },
    { key: "pay" as const, href: "/pay", label: "Pay", icon: WalletCards },
    { key: "create" as const, href: "/insurance", label: "Insurance\nbanao", icon: Plus },
    { key: "tracking" as const, href: "/tracking", label: "Tracking", icon: Route },
    { key: "partner" as const, href: "/partner", label: "Partner", icon: UsersRound },
  ];

  return (
    <ProtectedRoute
      allowedIdentities={["CUSTOMER", "BUYER", "SUPPLIER", "TRANSPORTER"]}
    >
      <ShellContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
        <div className={styles.root}>
          <div className={styles.workspace}>
            <aside className={styles.desktopRail} aria-label="Customer navigation">
              <div className={styles.railBrand}>Mandi Plus</div>
              <nav className={styles.railNav}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`${styles.railLink} ${
                        activeTab === item.key ? styles.railLinkActive : ""
                      }`}
                    >
                      <Icon size={20} strokeWidth={2.2} />
                      {item.label.replace("\n", " ")}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  className={styles.drawerLink}
                  onClick={() => setMenuOpen(true)}
                >
                  <Menu size={20} />
                  More
                </button>
              </nav>
              <div className={styles.drawerSpacer} />
              <div className={styles.profileBlock}>
                <div className={styles.avatar}>{initials(user?.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.profileName}>{user?.name || "Mandi Plus User"}</div>
                  <div className={styles.profilePhone}>{user?.mobileNumber || ""}</div>
                </div>
              </div>
            </aside>

            <div className={styles.appViewport}>
              <div
                className={`${styles.pageCanvas} ${home ? styles.homeCanvas : ""}`}
              >
                {children}
              </div>
            </div>

            {showBottomNav ? (
              <nav className={styles.bottomNav} aria-label="Customer tabs">
                <span className={styles.navShadow} aria-hidden="true" />
                <svg
                  className={styles.navShape}
                  viewBox="0 0 100 92"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 8 16 H 36 C 42 16 42 0 50 0 C 58 0 58 16 64 16 H 92 Q 100 16 100 24 V 84 Q 100 92 92 92 H 8 Q 0 92 0 84 V 24 Q 0 16 8 16 Z"
                    fill="#ffffff"
                    stroke="#e7ebf3"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isCreate = item.key === "create";
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={activeTab === item.key ? "page" : undefined}
                      className={`${styles.navItem} ${
                        activeTab === item.key ? styles.navItemActive : ""
                      } ${isCreate ? styles.navCreate : ""}`}
                    >
                      {isCreate ? (
                        <span className={styles.navCreateIcon}>
                          <Icon size={31} strokeWidth={2.2} />
                        </span>
                      ) : (
                        <span className={styles.navIcon}>
                          <Icon size={22} strokeWidth={2.2} />
                        </span>
                      )}
                      <span style={{ whiteSpace: "pre-line" }}>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {menuOpen ? (
              <>
                <button
                  type="button"
                  className={styles.drawerBackdrop}
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
                <aside className={styles.drawer} aria-label="Profile and files menu">
                  <div className={styles.profileBlock}>
                    <div className={styles.avatar}>{initials(user?.name)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={styles.profileName}>
                        {user?.name || "Mandi Plus User"}
                      </div>
                      <div className={styles.profilePhone}>
                        {user?.mobileNumber || ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.heroButton}
                      onClick={() => setMenuOpen(false)}
                      aria-label="Close menu"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <nav className={styles.drawerNav}>
                    <DrawerLink href="/insurance-dekho" icon={FileText} label="Insurance dekho!" />
                    <DrawerLink href="/customer/wallet" icon={WalletCards} label="Wallet" />
                    <DrawerLink href="/profile" icon={UserRound} label="Personal details" />
                    <DrawerLink href="/profile?section=language" icon={Languages} label="Language" />
                    <DrawerLink href="/profile?section=notifications" icon={Bell} label="Notifications" />
                    <DrawerLink href="/profile?section=security" icon={ShieldCheck} label="Security" />
                    <DrawerLink href="/support" icon={Headphones} label="Help & support" />
                    {partnerActive ? (
                      <DrawerLink href="/partner" icon={UsersRound} label="Partner portal" />
                    ) : null}
                    <DrawerLink
                      href="/terms-and-conditions"
                      icon={FileText}
                      label="Legal & policies"
                    />
                  </nav>
                  <div className={styles.drawerSpacer} />
                  <button
                    type="button"
                    className={`${styles.drawerLink} ${styles.logoutButton}`}
                    onClick={logout}
                  >
                    <LogOut size={20} />
                    Logout
                  </button>
                </aside>
              </>
            ) : null}
            <CustomerSetupModal />
          </div>
        </div>
      </ShellContext.Provider>
    </ProtectedRoute>
  );
}

function DrawerLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Link href={href} className={styles.drawerLink}>
      <Icon size={20} strokeWidth={2.1} />
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRight size={16} color="#9ba3af" />
    </Link>
  );
}
