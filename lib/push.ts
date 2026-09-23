// Server-only: reads VAPID secrets from process.env directly, must never be
// imported from a "use client" component. Deliberately agnostic of *which*
// subscription table a row came from — callers (lib/push-notifications.ts)
// pass in an onExpired callback so this file doesn't need to know about
// owner_push_subscriptions vs customer_push_subscriptions.

import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT; // "mailto:someone@example.com"

const configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string };

// Never throws — same resilience pattern as sendSms()/getWeather(). A
// missing VAPID config, or any send failure, just means no push goes out.
export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
  onExpired?: () => Promise<void>
): Promise<{ ok: boolean; error?: string }> {
  if (!configured) return { ok: false, error: "Push isn't configured yet — missing VAPID keys." };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Subscription is dead (browser reset, permission revoked, uninstalled
      // PWA, etc.) — let the caller delete its own row.
      await onExpired?.();
      return { ok: false, error: "expired" };
    }
    console.error("[push] sendNotification failed —", error);
    return { ok: false, error: "Couldn't send push." };
  }
}
