"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "@heroicons/react/24/outline";
import { getCustomerNotifications } from "@/features/customer/api";
import {
  enableWebPush,
  getCurrentWebPushSubscription,
  isWebPushAllowedForMobile,
  isWebPushAvailable,
  syncExistingWebPushSubscription,
} from "./webPush";

const DISMISS_KEY = "mandiplus:web-push-prompt-dismissed";

export function CustomerNotificationBell({ mobile }: { mobile?: string | null }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isWebPushAllowedForMobile(mobile)) return;
    void getCustomerNotifications(20)
      .then((result) => setUnread(result.unreadCount || 0))
      .catch(() => {});
  }, [mobile]);

  if (!isWebPushAllowedForMobile(mobile)) return null;
  return (
    <button
      type="button"
      onClick={() => router.push("/notifications")}
      className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e7ebf3] bg-white text-[#203044]"
      aria-label={unread ? `${unread} unread notifications` : "Open notifications"}
    >
      <BellIcon className="h-5 w-5" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c84f45] px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export function CustomerWebPushPrompt({ mobile }: { mobile?: string | null }) {
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isWebPushAvailable() || !isWebPushAllowedForMobile(mobile)) return;
    if (Notification.permission === "granted") {
      void syncExistingWebPushSubscription().catch(() => {});
    }
    void getCurrentWebPushSubscription().then((subscription) => {
      setVisible(
        !subscription &&
          Notification.permission !== "denied" &&
          localStorage.getItem(DISMISS_KEY) !== "1",
      );
    });
  }, [mobile]);

  if (!visible) return null;
  return (
    <section className="mx-auto mt-4 flex max-w-5xl items-center gap-3 border-y border-[#e7ebf3] bg-white px-5 py-4 sm:rounded-lg sm:border">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3fa] text-[#203044]">
        <BellIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#171914]">Get invoice alerts</p>
        <p className="text-xs font-medium text-[#7b8176]">Know when a new invoice or policy is ready.</p>
        {error ? <p className="mt-1 text-xs font-semibold text-[#c84f45]">{error}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            setError("");
            try {
              await enableWebPush();
              setVisible(false);
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : "Could not enable alerts.");
            } finally {
              setWorking(false);
            }
          }}
          className="min-h-10 rounded-lg bg-[#203044] px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          {working ? "Turning on..." : "Turn on"}
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="text-[11px] font-semibold text-[#7b8176]"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
