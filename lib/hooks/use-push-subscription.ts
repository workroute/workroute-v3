"use client";

import { useEffect, useState } from "react";
import { urlBase64ToUint8Array, type RawPushSubscription } from "@/lib/push-client";

interface UsePushSubscriptionResult {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  // Whether *this* browser currently holds an active push subscription —
  // distinct from `permission`, which stays "granted" forever even after
  // unsubscribe() removes the subscription itself.
  isSubscribed: boolean;
  subscribe: (
    onSubscribed: (sub: RawPushSubscription) => Promise<void>
  ) => Promise<"granted" | "denied" | "unavailable">;
  unsubscribe: (onUnsubscribed?: (endpoint: string) => Promise<void>) => Promise<void>;
}

// Mirrors lib/hooks/use-install-prompt.ts's conventions: browser-API access
// only inside useEffect/handlers, no localStorage/dismissal state owned
// here (left to the consuming component). Unlike PWA install — which the
// browser persists entirely on its own — saving a push subscription needs
// a destination that differs per consumer (owner: RLS upsert, customer:
// token-gated RPC), so subscribe() takes a save callback rather than
// handling persistence itself.
export function usePushSubscription(): UsePushSubscriptionResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (!supported) return;
    setPermission(Notification.permission);
    if (Notification.permission !== "granted") return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(!!subscription));
  }, []);

  async function subscribe(
    onSubscribed: (sub: RawPushSubscription) => Promise<void>
  ): Promise<"granted" | "denied" | "unavailable"> {
    if (!isSupported) return "unavailable";
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return result === "denied" ? "denied" : "unavailable";

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return "unavailable";

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    await onSubscribed(subscription.toJSON() as RawPushSubscription);
    setIsSubscribed(true);
    return "granted";
  }

  async function unsubscribe(onUnsubscribed?: (endpoint: string) => Promise<void>): Promise<void> {
    if (!isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await onUnsubscribed?.(endpoint);
    setIsSubscribed(false);
  }

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}
