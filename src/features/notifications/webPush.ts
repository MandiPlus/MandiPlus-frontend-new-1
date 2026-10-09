import {
  registerCustomerWebPushSubscription,
  removeCustomerWebPushSubscription,
} from "@/features/customer/api";

// VAPID public keys are delivered to every subscribed browser by design.
// Keep the private counterpart only in the backend deployment environment.
const PRODUCTION_VAPID_PUBLIC_KEY =
  "BE_BVSHD-rU_-KQcQN_i-0HCRzvW7kTStpQQtEaIxdTYTptWk6EssOvH5mykBBuWePqs9b9mhV8dFSII5m5w7Lw";
const PRODUCTION_CANARY_MOBILE = "9022353647";

export function isWebPushAvailable() {
  return (
    typeof window !== "undefined" &&
    webPushEnabled() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(vapidPublicKey())
  );
}

export function isWebPushAllowedForMobile(mobile?: string | null) {
  const allowed = canaryMobiles();
  return !allowed.length || allowed.includes(normalizeMobile(mobile || ""));
}

export async function getCurrentWebPushSubscription() {
  if (!isWebPushAvailable()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enableWebPush() {
  if (!isWebPushAvailable()) throw new Error("Notifications are not supported on this device.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not allowed.");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
    }));
  await saveSubscription(subscription);
  return subscription;
}

export async function syncExistingWebPushSubscription() {
  if (!isWebPushAvailable() || Notification.permission !== "granted") return null;
  const subscription = await getCurrentWebPushSubscription();
  if (subscription) await saveSubscription(subscription);
  return subscription;
}

export async function disableWebPushForCurrentBrowser() {
  if (!isWebPushAvailable()) return;
  const subscription = await getCurrentWebPushSubscription();
  if (!subscription) return;
  const removal = removeCustomerWebPushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
  await removal;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete notification subscription.");
  }
  await registerCustomerWebPushSubscription({
    endpoint: json.endpoint,
    expirationTime: json.expirationTime,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    deviceName: navigator.platform || undefined,
  });
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = window.atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function webPushEnabled() {
  const configured = process.env.NEXT_PUBLIC_WEB_PUSH_ENABLED;
  if (configured !== undefined) return configured === "true";
  return process.env.NODE_ENV === "production";
}

function vapidPublicKey() {
  return (
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_KEY ||
    (process.env.NODE_ENV === "production" ? PRODUCTION_VAPID_PUBLIC_KEY : "")
  );
}

function canaryMobiles() {
  const configured = process.env.NEXT_PUBLIC_WEB_PUSH_CANARY_MOBILES;
  const value =
    configured !== undefined
      ? configured
      : process.env.NODE_ENV === "production"
        ? PRODUCTION_CANARY_MOBILE
        : "";
  return String(value).split(",").map(normalizeMobile).filter(Boolean);
}
