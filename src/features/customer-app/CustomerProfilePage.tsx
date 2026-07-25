"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Languages,
  LoaderCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/features/auth/context/AuthContext";
import { updateCustomerUser } from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { INDIA_STATES } from "./indiaStates";
import { initials, readableError } from "./utils";
import styles from "./customer-app.module.css";

type ProfileSection = "main" | "details" | "language" | "notifications" | "security";
type NotificationPreferences = {
  incompleteDetails: boolean;
  tripUpdates: boolean;
  claimUpdates: boolean;
  walletUpdates: boolean;
};

const languageOptions = [
  ["hi", "हिन्दी"],
  ["en", "English"],
  ["te", "తెలుగు"],
  ["kn", "ಕನ್ನಡ"],
  ["mr", "मराठी"],
] as const;

export default function CustomerProfilePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, setUser, logout } = useAuth();
  const requested = params.get("section");
  const initialSection = isProfileSection(requested) ? requested : "main";
  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState(
    String(user?.preferredLanguage || "hi"),
  );
  const [profile, setProfile] = useState({
    name: String(user?.name || ""),
    state: String(user?.state || ""),
    mandiName: String(user?.mandiName || ""),
    secondaryMobileNumber: String(user?.secondaryMobileNumber || ""),
    identity: String(user?.identity || "CUSTOMER"),
    primaryCommodityCode: String(user?.primaryCommodityCode || ""),
    product: Array.isArray(user?.products)
      ? String(user.products[0] || "")
      : String(user?.commodity || ""),
    officeAddress: Array.isArray(user?.officeAddress)
      ? user.officeAddress.join(", ")
      : String(user?.officeAddress || ""),
  });
  const [notifications, setNotifications] = useState<NotificationPreferences>(() => {
    if (typeof window === "undefined") return defaultNotifications;
    try {
      return {
        ...defaultNotifications,
        ...JSON.parse(localStorage.getItem("mandiplus-notification-prefs") || "{}"),
      };
    } catch {
      return defaultNotifications;
    }
  });

  const phone = useMemo(
    () =>
      String(user?.mobileNumber || user?.phone || user?.phoneNumber || "").slice(
        -10,
      ),
    [user],
  );

  const goBack = () => {
    if (section === "main") router.push("/home");
    else {
      setSection("main");
      router.replace("/profile");
      setNotice("");
    }
  };

  const saveProfile = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const payload: Record<string, unknown> = {
        name: profile.name.trim(),
        state: profile.state.trim(),
        identity: profile.identity,
      };
      if (profile.mandiName.trim()) payload.mandiName = profile.mandiName.trim();
      if (profile.secondaryMobileNumber.trim()) {
        payload.secondaryMobileNumber = profile.secondaryMobileNumber
          .replace(/\D/g, "")
          .slice(-10);
      }
      if (profile.product.trim()) payload.products = [profile.product.trim()];
      if (profile.primaryCommodityCode) {
        payload.primaryCommodityCode = profile.primaryCommodityCode;
      }
      if (profile.officeAddress.trim()) {
        payload.officeAddress = [profile.officeAddress.trim()];
      }
      const updated = await updateCustomerUser(user.id, payload);
      setUser((current: Record<string, unknown>) => ({
        ...current,
        ...payload,
        ...updated,
      }));
      setNotice("Profile save ho gaya.");
      setSection("main");
      router.replace("/profile");
    } catch (error) {
      setNotice(readableError(error, "Profile save nahi ho saka."));
    } finally {
      setSaving(false);
    }
  };

  const saveLanguage = async (nextLanguage: string) => {
    if (!user?.id || saving) return;
    const previous = language;
    setLanguage(nextLanguage);
    setSaving(true);
    setNotice("");
    try {
      const updated = await updateCustomerUser(user.id, {
        preferredLanguage: nextLanguage,
      });
      setUser((current: Record<string, unknown>) => ({
        ...current,
        ...updated,
        preferredLanguage: nextLanguage,
      }));
    } catch (error) {
      setLanguage(previous);
      setNotice(readableError(error, "Language update nahi ho saki."));
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem("mandiplus-notification-prefs", JSON.stringify(next));
      return next;
    });
  };

  return (
    <CustomerAppShell activeTab="partner" showBottomNav={false}>
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={goBack}
          aria-label="Back"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>
          {section === "main" ? "Profile" : sectionLabel(section)}
        </h1>
        <span />
      </header>

      <main className={styles.pageBody}>
        {section === "main" ? (
          <>
            <section className={styles.profileHeroCard}>
              <div className={styles.profileHeroAvatar}>
                {initials(profile.name)}
              </div>
              <div>
                <div className={styles.profileHeroName}>
                  {profile.name || "Mandi Plus user"}
                </div>
                <div className={styles.profileHeroPhone}>
                  {phone ? `+91 ${phone}` : "Mobile OTP account"}
                </div>
              </div>
            </section>

            <section className={styles.settingsCard}>
              <SettingsRow
                icon={<UserRound size={21} />}
                title="Aapki details"
                onClick={() => setSection("details")}
              />
              <SettingsRow
                icon={<Languages size={21} />}
                title="Language"
                sub={
                  languageOptions.find(([code]) => code === language)?.[1] ||
                  "हिन्दी"
                }
                onClick={() => setSection("language")}
              />
              <SettingsRow
                icon={<Bell size={21} />}
                title="Notifications"
                onClick={() => setSection("notifications")}
              />
              <SettingsRow
                icon={<ShieldCheck size={21} />}
                title="Security"
                last
                onClick={() => setSection("security")}
              />
            </section>
          </>
        ) : null}

        {section === "details" ? (
          <section className={styles.formCard}>
            <ProfileField
              label="Name"
              value={profile.name}
              onChange={(value) => setProfile({ ...profile, name: value })}
            />
            <ProfileSelect
              label="Location"
              value={profile.state}
              options={INDIA_STATES}
              onChange={(value) => setProfile({ ...profile, state: value })}
            />
            <ProfileField
              label="Mandi name"
              value={profile.mandiName}
              onChange={(value) => setProfile({ ...profile, mandiName: value })}
            />
            <ProfileField
              label="Alternate mobile"
              inputMode="tel"
              value={profile.secondaryMobileNumber}
              onChange={(value) =>
                setProfile({ ...profile, secondaryMobileNumber: value })
              }
            />
            <ProfileField
              label="Primary commodity"
              value={profile.product}
              onChange={(value) => setProfile({ ...profile, product: value })}
            />
            <button
              type="button"
              className={styles.wideButton}
              onClick={() => void saveProfile()}
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : null}
              Save changes
            </button>
          </section>
        ) : null}

        {section === "language" ? (
          <section className={styles.settingsCard}>
            {languageOptions.map(([code, label], index) => (
              <SettingsRow
                key={code}
                title={label}
                last={index === languageOptions.length - 1}
                trailing={
                  language === code ? (
                    <Check size={20} color="#584ab8" />
                  ) : undefined
                }
                onClick={() => void saveLanguage(code)}
              />
            ))}
          </section>
        ) : null}

        {section === "notifications" ? (
          <section className={styles.settingsCard}>
            {(
              [
                ["incompleteDetails", "Incomplete details", "Invoice and claim reminders"],
                ["tripUpdates", "Trip updates", "Vehicle and delivery progress"],
                ["claimUpdates", "Claim updates", "Status and document reminders"],
                ["walletUpdates", "Wallet updates", "Balance and payment activity"],
              ] as const
            ).map(([key, title, sub], index) => (
              <SettingsRow
                key={key}
                title={title}
                sub={sub}
                last={index === 3}
                trailing={
                  <span
                    className={`${styles.switch} ${
                      notifications[key] ? styles.switchOn : ""
                    }`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                }
                onClick={() => toggleNotification(key)}
              />
            ))}
          </section>
        ) : null}

        {section === "security" ? (
          <>
            <section className={styles.settingsCard}>
              <SettingsRow title="Sign-in method" sub="Mobile OTP" />
              <SettingsRow
                title="Registered mobile"
                sub={phone ? `+91 ${phone}` : "Not available"}
              />
              <SettingsRow title="Session" sub="Active on this device" last />
            </section>
            <button
              type="button"
              className={`${styles.wideButton} ${styles.dangerWideButton}`}
              onClick={logout}
            >
              Sign out of this device
            </button>
          </>
        ) : null}

        {notice ? <div className={styles.notice}>{notice}</div> : null}
      </main>
    </CustomerAppShell>
  );
}

function SettingsRow({
  icon,
  title,
  sub,
  trailing,
  last = false,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  trailing?: React.ReactNode;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.settingsRow} ${
        last ? styles.settingsRowLast : ""
      }`}
      onClick={onClick}
      disabled={!onClick}
    >
      {icon ? <span className={styles.settingsIcon}>{icon}</span> : null}
      <span className={styles.settingsText}>
        <strong>{title}</strong>
        {sub ? <small>{sub}</small> : null}
      </span>
      {trailing || (onClick ? <ChevronRight size={18} /> : null)}
    </button>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ProfileSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select State</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const defaultNotifications: NotificationPreferences = {
  incompleteDetails: true,
  tripUpdates: true,
  claimUpdates: true,
  walletUpdates: true,
};

function isProfileSection(value: string | null): value is ProfileSection {
  return ["main", "details", "language", "notifications", "security"].includes(
    value || "",
  );
}

function sectionLabel(section: ProfileSection) {
  if (section === "details") return "Personal details";
  if (section === "language") return "Language";
  if (section === "notifications") return "Notifications";
  if (section === "security") return "Security";
  return "Profile";
}
