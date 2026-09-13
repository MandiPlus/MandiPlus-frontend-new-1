"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
      window.location.hostname,
    );

    const pushDevEnabled = process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH_DEV === "true";

    if ((process.env.NODE_ENV !== "production" || isLocalHost) && !pushDevEnabled) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .then(() => {
          if (!("caches" in window)) return;
          return caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.includes("mandiplus"))
                  .map((key) => caches.delete(key)),
              ),
            );
        })
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {});
  }, []);

  return null;
}
