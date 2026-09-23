"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Resilience feature — fine to no-op if registration fails.
      });
      return;
    }

    // Dev mode: a registered SW caches /_next/static chunks, and dev chunk
    // URLs don't change on every recompile the way production's hashed
    // filenames do — so a stale cached chunk can silently keep serving old
    // code after a rebuild. Unregister anything left over from earlier
    // testing so dev always reflects what's actually on disk.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
