import {
  registerCustomerWebPushSubscription,
  removeCustomerWebPushSubscription,
} from "@/features/customer/api";

export function isWebPushAvailable() {
  return (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_WEB_PUSH_ENABLED === "true" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_KEY)
  );
}

export function isWebPushAllowedForMobile(mobile?: string | null) {
  const allowed = String(process.env.NEXT_PUBLIC_WEB_PUSH_CANARY_MOBILES || "")
    .split(",")
    .map(normalizeMobile)
    .filter(Boolean);
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
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_KEY || "",
      ),
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
