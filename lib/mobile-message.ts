// §13 — Mobile Message SMS client. Server-only: reads secrets from
// process.env directly (no NEXT_PUBLIC_ prefix), so this must never be
// imported from a "use client" component. See .env.local.example for setup.

const API_URL = "https://api.mobilemessage.com.au/v1/messages";

type MobileMessageResult = {
  status: string;
  results?: { status: string; to: string }[];
};

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const username = process.env.MOBILEMESSAGE_USERNAME;
  const password = process.env.MOBILEMESSAGE_PASSWORD;
  const sender = process.env.MOBILEMESSAGE_SENDER_ID;

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
