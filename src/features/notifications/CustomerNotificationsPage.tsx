"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, BellIcon, CheckIcon } from "@heroicons/react/24/outline";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import {
  CustomerNotification,
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "@/features/customer/api";

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCustomerNotifications();
      setItems(result.items || []);
      setUnreadCount(result.unreadCount || 0);
    } catch {
      setError("Could not load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNotification = async (item: CustomerNotification) => {
    if (!item.readAt) void markCustomerNotificationRead(item.id).catch(() => {});
    const invoiceId = stringValue(item.payload?.invoiceId);
    if (invoiceId) {
      router.push(
        `/my-insurance-forms?tab=all&invoiceId=${encodeURIComponent(invoiceId)}&notificationId=${encodeURIComponent(item.id)}`,
      );
      return;
    }
    router.push("/home");
  };

  return (
    <ProtectedRoute allowedIdentities={["BUYER", "SUPPLIER", "CUSTOMER", "TRANSPORTER"]}>
      <div className="min-h-screen bg-[#f5f6fb] pb-20 text-[#171914]">
        <header className="border-b border-[#e7ebf3] bg-white px-5 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e7ebf3] text-[#203044]"
              aria-label="Back to home"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0 text-center">
              <h1 className="text-xl font-black">Notifications</h1>
              <p className="text-xs font-semibold text-[#7b8176]">
                {unreadCount ? `${unreadCount} unread` : "You are up to date"}
              </p>
            </div>
            <button
              type="button"
              disabled={!unreadCount}
              onClick={async () => {
                await markAllCustomerNotificationsRead();
                setItems((current) =>
                  current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
                );
                setUnreadCount(0);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e7ebf3] text-[#203044] disabled:opacity-35"
              aria-label="Mark all as read"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-5">
          {error ? (
            <button type="button" onClick={load} className="w-full rounded-lg border border-[#ffe7e0] bg-white p-4 text-sm font-semibold text-[#c84f45]">
              {error}
            </button>
          ) : loading ? (
            <div className="grid gap-2" aria-label="Loading notifications">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-white" />)}
            </div>
          ) : items.length ? (
            <div className="overflow-hidden rounded-lg border border-[#e7ebf3] bg-white">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="flex w-full items-start gap-3 border-b border-[#edf0f5] px-4 py-4 text-left last:border-b-0"
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.readAt ? "bg-[#f5f6fb] text-[#7b8176]" : "bg-[#eef3fa] text-[#203044]"}`}>
                    <BellIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="mt-0.5 block text-sm font-medium text-[#62695f]">{item.body}</span>
                    <span className="mt-1 block text-xs font-medium text-[#92988e]">{formatTime(item.createdAt)}</span>
                  </span>
                  {!item.readAt ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#c84f45]" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#d7deea] bg-white px-5 py-12 text-center">
              <BellIcon className="mx-auto h-7 w-7 text-[#7b8176]" />
              <p className="mt-3 text-sm font-bold">No notifications yet</p>
              <p className="mt-1 text-xs font-medium text-[#7b8176]">New invoice and policy updates will appear here.</p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}
