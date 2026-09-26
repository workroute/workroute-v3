// §admin-number-provisioning — Vapi's management API (creating SIP trunk
// credentials and phone numbers), called from the app for the first time
// here. Every prior use of these endpoints this project was a one-off
// direct curl call during the SIP 407 debugging saga — this codifies the
// exact proven-working shape from that fix (2026-09-20) as real code.
//
// The one hard lesson from that saga: Vapi silently fails to apply a PATCH
// to an existing BYO SIP trunk credential — it keeps using stale internal
// auth regardless of what the API shows. The only reliable fix is to
// always CREATE fresh credential + phone-number resources, never patch an
// existing one. Every function here only ever POSTs new resources.

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE = "https://api.vapi.ai";

// The bearer-token credential Vapi uses to authenticate its own webhook
// calls back to WorkRoute (app/api/vapi/webhook/route.ts checks
// x-vapi-secret against VAPI_WEBHOOK_SECRET) — this is WorkRoute-side
// shared infrastructure, the same for every tradie's number, not
// per-tenant. Reuses the existing working credential id rather than
// creating a new one per number.
const WEBHOOK_AUTH_CREDENTIAL_ID = process.env.VAPI_WEBHOOK_CREDENTIAL_ID;

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" };
}

export async function createVapiSipTrunkCredential(params: {
  name: string;
  sipUsername: string;
  sipPassword: string;
}): Promise<{ id: string }> {
  if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured.");

  const res = await fetch(`${VAPI_BASE}/credential`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      provider: "byo-sip-trunk",
      name: params.name,
      gateways: [{ ip: "23.106.241.2", inboundEnabled: true }],
      outboundAuthenticationPlan: {
        authUsername: params.sipUsername,
        authPassword: params.sipPassword,
        sipRegisterPlan: {
          domain: "sip.au.didlogic.net",
          username: params.sipUsername,
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi credential creation failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  return { id: data.id };
}

export async function createVapiPhoneNumber(params: {
  number: string;
  credentialId: string;
  webhookUrl: string;
}): Promise<{ id: string }> {
  if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured.");
  if (!WEBHOOK_AUTH_CREDENTIAL_ID) {
    throw new Error("VAPI_WEBHOOK_CREDENTIAL_ID is not configured — needed for the phone number's server block.");
  }

  const res = await fetch(`${VAPI_BASE}/phone-number`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      provider: "byo-phone-number",
      number: params.number,
      credentialId: params.credentialId,
      server: {
        url: params.webhookUrl,
        timeoutSeconds: 20,
        credentialId: WEBHOOK_AUTH_CREDENTIAL_ID,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi phone-number creation failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  return { id: data.id };
}
