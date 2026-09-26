// §admin-number-provisioning — thin wrappers around DIDLogic's real v1/v2
// REST API (docs.didlogic.com), confirmed endpoint-by-endpoint against their
// live developer portal rather than guessed. Same plain-fetch, no-SDK
// pattern as lib/google-maps.ts. Every call here needs DIDLOGIC_API_KEY, a
// Bearer token requested from DIDLogic's account manager — separate from
// the existing SIP account username/password already in use for the one
// working number.

const DIDLOGIC_API_KEY = process.env.DIDLOGIC_API_KEY;
const DIDLOGIC_BASE = "https://app.didlogic.com/api";

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${DIDLOGIC_API_KEY}`, Accept: "application/json" };
}

export type DidlogicAvailableNumber = {
  id: number;
  number: string;
  cityName: string | null;
  countryName: string | null;
  monthlyFee: number | null;
  activationFee: number | null;
};

export async function getDidlogicBalance(): Promise<number | null> {
  if (!DIDLOGIC_API_KEY) return null;
  const res = await fetch(`${DIDLOGIC_BASE}/v1/balance`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.balance === "number" ? data.balance : null;
}

// §search-numbers-advanced — GET /api/v2/numbers/search. Scoped to Australia
// always (WorkRoute is AU-only per every other part of this app), optional
// city filter so results can be biased toward the tradie's own service
// area. cheap_sorting=true so the cheapest options surface first — the
// owner is picking one for a small business, not shopping vanity numbers.
export async function searchAustralianNumbers(city?: string | null): Promise<DidlogicAvailableNumber[]> {
  if (!DIDLOGIC_API_KEY) throw new Error("DIDLOGIC_API_KEY is not configured.");

  const params = new URLSearchParams({
    country_name_contains: "Australia",
    cheap_sorting: "true",
    per_page: "25",
  });
  if (city) params.set("city_name_contains", city);

  const res = await fetch(`${DIDLOGIC_BASE}/v2/numbers/search?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DIDLogic number search failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  // §confirmed-against-real-response — the search results are nested one
  // level deeper than the endpoint's own top-level "dids" key suggests:
  // {dids: {dids: [...], pagination: {...}}}. city/country come back as
  // plain strings (e.g. "Brisbane, QLD"), not the nested {name} shape
  // originally guessed from the docs alone.
  const dids = data?.dids?.dids ?? [];
  return dids.map((d: any) => ({
    id: d.id,
    number: d.number,
    cityName: d.city ?? null,
    countryName: d.country ?? null,
    monthlyFee: d.monthly ?? null,
    activationFee: d.activation ?? null,
  }));
}

// §create-sip-account — POST /api/v1/sipaccounts. A fresh SIP account per
// tradie, never shared and never reused across purchases — mirrors the
// "always create fresh, never patch" lesson from the SIP 407 saga, applied
// one level earlier (the DIDLogic side, not just the Vapi side).
export async function createDidlogicSipAccount(label: string): Promise<{ username: string; password: string }> {
  if (!DIDLOGIC_API_KEY) throw new Error("DIDLOGIC_API_KEY is not configured.");

  const password = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const form = new URLSearchParams();
  form.set("sipaccount[label]", label);
  form.set("sipaccount[password]", password);

  const res = await fetch(`${DIDLOGIC_BASE}/v1/sipaccounts`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DIDLogic SIP account creation failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  const sipaccount = data?.sipaccount ?? {};
  const username: string | undefined = sipaccount.name ?? sipaccount.username ?? sipaccount.id?.toString();
  if (!username) throw new Error("DIDLogic SIP account created but returned no username — check response shape.");
  return { username, password };
}

// §purchase-numbers — POST /api/v2/numbers/purchase. Confirmed (2026-09-24,
// GET /api/v2/identities) that the account already has a verified "Primary"
// identity (id 6756 — driver's licence + power bill, both
// approvement_status "verified") — every AU number purchase gets
// associated with it via the `identities` param, matching the shape
// DIDLogic's docs show: [{"id":..., "did_ids":[...]}].
const DIDLOGIC_IDENTITY_ID = process.env.DIDLOGIC_IDENTITY_ID;

export async function purchaseDidlogicNumber(didId: number): Promise<{ purchaseId: string; number: string }> {
  if (!DIDLOGIC_API_KEY) throw new Error("DIDLOGIC_API_KEY is not configured.");
  if (!DIDLOGIC_IDENTITY_ID) throw new Error("DIDLOGIC_IDENTITY_ID is not configured.");

  const form = new URLSearchParams();
  form.set("id_in[]", String(didId));
  form.set("identities[][id]", DIDLOGIC_IDENTITY_ID);
  form.set("identities[][did_ids][]", String(didId));

  const res = await fetch(`${DIDLOGIC_BASE}/v2/numbers/purchase`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DIDLogic purchase failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json();
  const purchased = data?.purchase?.[0] ?? data?.purchase ?? {};
  const number: string | undefined = purchased.number;
  const purchaseId: string | undefined = purchased.id?.toString() ?? number;
  if (!number || !purchaseId) throw new Error("DIDLogic purchase succeeded but returned no number/id — check response shape.");
  return { purchaseId, number };
}

// §create-destination — POST /api/v1/purchases/{purchase_id}/destinations.
// transport=5 ("SIP device") routes the purchased DID to the SIP account
// just created above, by its username.
export async function routeDidlogicNumberToSipAccount(purchaseId: string, sipUsername: string): Promise<void> {
  if (!DIDLOGIC_API_KEY) throw new Error("DIDLOGIC_API_KEY is not configured.");

  const form = new URLSearchParams();
  form.set("destination[destination]", sipUsername);
  form.set("destination[transport]", "5");
  form.set("destination[active]", "true");

  const res = await fetch(`${DIDLOGIC_BASE}/v1/purchases/${encodeURIComponent(purchaseId)}/destinations`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DIDLogic destination routing failed (${res.status}): ${body || res.statusText}`);
  }
}
