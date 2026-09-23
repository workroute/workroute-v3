// Browser-safe — no "web-push" import here (that's a Node-only server
// package; importing it from a client-reachable file would break bundling).
// Shared by the subscribe hook and anything else that needs to talk to the
// PushManager API directly.

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type RawPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
