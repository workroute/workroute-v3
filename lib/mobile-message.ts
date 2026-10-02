// §13 — Mobile Message SMS client. Server-only: reads secrets from
// process.env directly (no NEXT_PUBLIC_ prefix), so this must never be
// imported from a "use client" component. See .env.local.example for setup.

import type { SupabaseClient } from "@supabase/supabase-js";

const API_URL = "https://api.mobilemessage.com.au/v1/messages";

type MobileMessageResult = {
  status: string;
  results?: { status: string; to: string }[];
};

// senderOverride must already be an approved sender on the Mobile Message
// account (GET /v1/senders) — otherwise the default sender is used.
export async function sendSms(
  to: string,
  message: string,
  senderOverride?: string
): Promise<{ ok: boolean; error?: string }> {
  const username = process.env.MOBILEMESSAGE_USERNAME;
  const password = process.env.MOBILEMESSAGE_PASSWORD;
  const sender = senderOverride || process.env.MOBILEMESSAGE_SENDER_ID;

  if (!username || !password || !sender) {
    return { ok: false, error: "SMS isn't configured yet — missing Mobile Message credentials." };
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        messages: [{ to, message, sender }],
      }),
    });
  } catch {
    return { ok: false, error: "Couldn't reach Mobile Message." };
  }

  const data = (await response.json().catch(() => null)) as MobileMessageResult | null;
  const result = data?.results?.[0];

  if (!response.ok || data?.status !== "complete" || result?.status !== "success") {
    return { ok: false, error: result?.status ?? `Mobile Message API error (${response.status})` };
  }

  return { ok: true };
}

// §own-mobile-sender — customer texts go out from the tradie's OWN mobile
// once they've confirmed it with Mobile Message, so a customer who just hits
// reply reaches the tradie. Until then they fall back to the default sender,
// a shared Mobile Message number that replies don't reliably reach.

const SENDERS_URL = "https://api.mobilemessage.com.au/v1/senders";

function authHeader(): string | null {
  const username = process.env.MOBILEMESSAGE_USERNAME;
  const password = process.env.MOBILEMESSAGE_PASSWORD;
  if (!username || !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

// "0412 345 678", "+61412345678" → "61412345678". Mobiles only (04…), since
// Mobile Message can only register a mobile as an own-number sender.
export function normalizeAuMobile(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  const national = digits.startsWith("61") ? `0${digits.slice(2)}` : digits;
  return /^04\d{8}$/.test(national) ? `61${national.slice(1)}` : null;
}

// Cached per server instance so a burst of texts (e.g. the invoice-chase
// cron) doesn't hit /v1/senders once per message. A just-confirmed number
// can take up to this long to start being used — the settings page passes
// fresh=true so the tradie still sees the real status straight away.
const SENDERS_CACHE_MS = 5 * 60 * 1000;
let sendersCache: { at: number; ownNumbers: Set<string> } | null = null;

async function activeOwnSenders(fresh = false): Promise<Set<string>> {
  if (!fresh && sendersCache && Date.now() - sendersCache.at < SENDERS_CACHE_MS) {
    return sendersCache.ownNumbers;
  }
  const auth = authHeader();
  if (!auth) return new Set();
  try {
    const response = await fetch(SENDERS_URL, { headers: { Authorization: auth }, cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { results?: { sender: string; type: string }[] } | null;
    if (!response.ok || !data?.results) return sendersCache?.ownNumbers ?? new Set();
    const ownNumbers = new Set(data.results.filter((s) => s.type === "own").map((s) => s.sender));
    sendersCache = { at: Date.now(), ownNumbers };
    return ownNumbers;
  } catch {
    return sendersCache?.ownNumbers ?? new Set();
  }
}

export async function isOwnSenderActive(phone: string | null | undefined, fresh = false): Promise<boolean> {
  const number = normalizeAuMobile(phone);
  return !!number && (await activeOwnSenders(fresh)).has(number);
}

// Mobile Message texts the number a confirmation link (free); it only
// becomes a usable sender once the owner taps it.
export async function registerOwnSender(phone: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const number = normalizeAuMobile(phone);
  if (!number) return { ok: false, error: "That doesn't look like an Australian mobile number (04…)." };
  const auth = authHeader();
  if (!auth) return { ok: false, error: "SMS isn't configured yet — missing Mobile Message credentials." };
  try {
    const response = await fetch(SENDERS_URL, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ number: `0${number.slice(2)}`, label: label.slice(0, 50) }),
    });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? `Mobile Message error (${response.status})` };
  } catch {
    return { ok: false, error: "Couldn't reach Mobile Message." };
  }
}

// Any text going to a business's CUSTOMER should use this rather than
// sendSms directly, so it comes from the tradie's own mobile when it can.
// Alerts to the tradie themselves keep using sendSms (from WorkRoute).
export async function sendCustomerSms(
  supabase: SupabaseClient,
  businessId: string,
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: profile } = await supabase.from("business_profiles").select("phone").eq("user_id", businessId).maybeSingle();
  const sender = (await isOwnSenderActive(profile?.phone)) ? normalizeAuMobile(profile?.phone)! : undefined;
  return sendSms(to, message, sender);
}
