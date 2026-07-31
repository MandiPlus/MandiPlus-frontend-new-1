"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  getCachedStates,
  useReferenceCommodities,
  useReferenceStates,
} from "@/features/reference";
import { updateCustomerUser } from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { initials, readableError } from "./utils";
import styles from "./customer-app.module.css";

type ProfileSection =
  "main" | "details" | "language" | "notifications" | "security";
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

const profileRoles = [
  ["BUYER", "Buyer"],
  ["SUPPLIER", "Supplier"],
  ["TRANSPORTER", "Transporter"],
] as const;

const businessSizeOptions = [
  ["2-10", "2 - 10 vehicles"],
  ["10-20", "10 - 20 vehicles"],
  ["20-50", "20 - 50 vehicles"],
  ["50+", "50+ vehicles"],
] as const;

type ProfileFormState = {
  name: string;
  state: string;
  mandiName: string;
  secondaryMobileNumber: string;
  identity: string;
  commodityCodes: string[];
  primaryCommodityCode: string;
  businessSize: string;
};

export default function CustomerProfilePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, setUser, logout } = useAuth();
  const states = useReferenceStates();
  const commodities = useReferenceCommodities();
  const requested = params.get("section");
  const initialSection = isProfileSection(requested) ? requested : "details";
  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState(
    String(user?.preferredLanguage || "hi"),
  );
  const [profile, setProfile] = useState(() => profileFromUser(user, commodities));
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    () => {
      if (typeof window === "undefined") return defaultNotifications;
      try {
        return {
          ...defaultNotifications,
          ...JSON.parse(
            localStorage.getItem("mandiplus-notification-prefs") || "{}",
          ),
        };
      } catch {
        return defaultNotifications;
      }
    },
  );

  const phone = useMemo(
    () =>
      String(
        user?.mobileNumber || user?.phone || user?.phoneNumber || "",
      ).slice(-10),
    [user],
  );

  useEffect(() => {
    setSection(isProfileSection(requested) ? requested : "details");
  }, [requested]);

  const goBack = () => {
    if (section === "main") router.push("/home");
    else {
      setSection("main");
      router.replace("/profile?section=main");
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
      };
      if (profile.mandiName.trim())
        payload.mandiName = profile.mandiName.trim();
      if (profile.secondaryMobileNumber.trim()) {
        payload.secondaryMobileNumber = profile.secondaryMobileNumber
          .replace(/\D/g, "")
          .slice(-10);
      }
      if (profile.identity) payload.identity = profile.identity;
      if (profile.commodityCodes.length) {
        payload.commodityCodes = profile.commodityCodes;
        payload.primaryCommodityCode = profile.commodityCodes[0];
        payload.products = profile.commodityCodes.map(
          (code) =>
            commodities.find((item) => item.code === code)?.label || code,
        );
      } else if (profile.primaryCommodityCode) {
        const selectedCommodity = commodities.find(
          (item) => item.code === profile.primaryCommodityCode,
        );
        payload.primaryCommodityCode = profile.primaryCommodityCode;
        if (selectedCommodity) payload.products = [selectedCommodity.label];
      }
      if (profile.businessSize) {
        payload.unionMember = `Vehicles: ${profile.businessSize}`;
      }
      const updated = await updateCustomerUser(user.id, payload);
      setUser((current: Record<string, unknown>) => ({
        ...current,
        ...payload,
        ...updated,
      }));
      setNotice("Profile save ho gaya.");
      setSection("main");
      router.replace("/profile?section=main");
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
      localStorage.setItem(
        "mandiplus-notification-prefs",
        JSON.stringify(next),
      );
      return next;
    });
  };

  const discardProfile = () => {
    setProfile(profileFromUser(user, commodities));
    setNotice("");
    setSection("main");
    router.replace("/profile?section=main");
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
          <section className={styles.profileDetailsPanel}>
            <ProfileField
              label="Name"
              value={profile.name}
              placeholder="Enter your full name"
              onChange={(value) => setProfile({ ...profile, name: value })}
            />
            <ProfileSelect
              label="State"
              value={profile.state}
              options={states}
              onChange={(value) => setProfile({ ...profile, state: value })}
            />
            <ProfileField
              label="Mandi name"
              value={profile.mandiName}
              placeholder="Enter mandi name"
              onChange={(value) => setProfile({ ...profile, mandiName: value })}
            />
            <ProfileField
              label="Secondary mobile"
              inputMode="tel"
              maxLength={10}
              placeholder="10-digit alternate number"
              value={profile.secondaryMobileNumber}
              onChange={(value) =>
                setProfile({
                  ...profile,
                  secondaryMobileNumber: value.replace(/\D/g, "").slice(0, 10),
                })
              }
            />
            <div className={styles.profileField}>
              <span>I am a</span>
              <div className={styles.profileRoleSelector}>
                {profileRoles.map(([value, label]) => {
                  const active = profile.identity === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={active ? styles.profileRoleActive : ""}
                      aria-pressed={active}
                      onClick={() =>
                        setProfile({ ...profile, identity: value })
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.profileField}>
              <span>Commodities</span>
              <div className={styles.profileRoleSelector}>
                {commodities.map((item) => {
                  const active = profile.commodityCodes.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      className={active ? styles.profileRoleActive : ""}
                      aria-pressed={active}
                      onClick={() => {
                        const next = active
                          ? profile.commodityCodes.filter(
                              (code) => code !== item.code,
                            )
                          : [...profile.commodityCodes, item.code];
                        setProfile({
                          ...profile,
                          commodityCodes: next,
                          primaryCommodityCode: next[0] || "",
                        });
                      }}
                    >
                      {item.emoji} {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <ProfileSelect
              label="Business size"
              value={profile.businessSize}
              options={businessSizeOptions.map(([value, label]) => ({
                value,
                label,
              }))}
              placeholder="Select business size"
              onChange={(value) =>
                setProfile({ ...profile, businessSize: value })
              }
            />
            <div className={styles.profileFormActions}>
              <button
                type="button"
                className={styles.profileDiscardButton}
                onClick={discardProfile}
                disabled={saving}
              >
                Discard
              </button>
              <button
                type="button"
                className={styles.profileSaveButton}
                onClick={() => void saveProfile()}
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : null}
                Save changes
              </button>
            </div>
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
                [
                  "incompleteDetails",
                  "Incomplete details",
                  "Invoice and claim reminders",
                ],
                [
                  "tripUpdates",
                  "Trip updates",
                  "Vehicle and delivery progress",
                ],
                [
                  "claimUpdates",
                  "Claim updates",
                  "Status and document reminders",
                ],
                [
                  "walletUpdates",
                  "Wallet updates",
                  "Balance and payment activity",
                ],
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
      className={`${styles.settingsRow} ${last ? styles.settingsRowLast : ""}`}
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
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "tel";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
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
  placeholder = "Select State",
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
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

function normalizeState(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return getCachedStates().some((option) => option.value === normalized)
    ? normalized
    : "";
}

function profileFromUser(
  user: Record<string, unknown> | null | undefined,
  commodities: Array<{ code: string; label: string }> = [],
): ProfileFormState {
  const commodityCodes = commodityCodesFromUser(user, commodities);
  return {
    name: String(user?.name || ""),
    state: normalizeState(user?.state),
    mandiName: String(user?.mandiName || ""),
    secondaryMobileNumber: String(user?.secondaryMobileNumber || "")
      .replace(/\D/g, "")
      .slice(-10),
    identity: normalizeProfileRole(user?.identity),
    commodityCodes,
    primaryCommodityCode: commodityCodes[0] || "",
    businessSize: businessSizeFromUser(user?.unionMember),
  };
}

function normalizeProfileRole(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return profileRoles.some(([role]) => role === normalized) ? normalized : "";
}

function commodityCodesFromUser(
  user: Record<string, unknown> | null | undefined,
  commodities: Array<{ code: string; label: string }> = [],
) {
  if (Array.isArray(user?.commodityCodes)) {
    return [
      ...new Set(
        user.commodityCodes
          .map((code) => normalizeCommodityCode(code, commodities))
          .filter(Boolean),
      ),
    ];
  }
  const onboardingCodes = Array.isArray(
    (user?.onboarding as { commodityCodes?: unknown } | undefined)
      ?.commodityCodes,
  )
    ? (
        (user?.onboarding as { commodityCodes: unknown[] }).commodityCodes || []
      )
        .map((code) => normalizeCommodityCode(code, commodities))
        .filter(Boolean)
    : [];
  const explicit = normalizeCommodityCode(
    user?.primaryCommodityCode,
    commodities,
  );
  const products = Array.isArray(user?.products) ? user.products : [];
  const fromProducts = products
    .map((product) => commodityCodeFromLabel(product))
    .filter(Boolean);
  return [
    ...new Set([
      ...onboardingCodes,
      ...(explicit ? [explicit] : []),
      ...fromProducts,
    ]),
  ];
}

function normalizeCommodityCode(
  value: unknown,
  commodities: Array<{ code: string }> = [],
) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  if (!normalized) return "";
  if (!commodities.length) return normalized;
  return commodities.some((item) => item.code === normalized) ? normalized : "";
}

function commodityCodeFromLabel(value: unknown) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "";
  if (
    normalized.includes("tender coconut") ||
    normalized === "coconut" ||
    normalized === "green coconut"
  ) {
    return "TENDER_COCONUT";
  }
  if (normalized.includes("tomato")) return "TOMATO";
  if (normalized.includes("mango")) return "MANGO";
  if (normalized.includes("banana")) return "BANANA";
  if (normalized.includes("onion")) return "ONION";
  if (normalized.includes("potato")) return "POTATO";
  if (normalized.includes("pomegranate") || normalized.includes("anar")) {
    return "POMEGRANATE";
  }
  return "OTHER";
}

function businessSizeFromUser(value: unknown) {
  const storedValue = String(value || "");
  return (
    businessSizeOptions.find(([size]) => storedValue.includes(size))?.[0] || ""
  );
}

function sectionLabel(section: ProfileSection) {
  if (section === "details") return "Aapki details";
  if (section === "language") return "Language";
  if (section === "notifications") return "Notifications";
  if (section === "security") return "Security";
  return "Profile";
}
