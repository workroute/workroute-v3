// Google Maps integration — two jobs, both solving problems the phone AI
// hit on real calls (§ "Next planned build" in project memory):
//
// 1. geocodeAddress: turns whatever the caller said into a real, canonical
//    address + lat/lng, or tells us it couldn't find one. This is the fix
//    for STT mishearing a street name ("Trees" for "Street") — Google can
//    only match a real street, so a bad transcription either resolves to
//    the correct spelling or fails outright, either way better than
//    silently saving whatever Deepgram guessed.
// 2. getDrivingMinutesFromOrigin: real driving time between a candidate
//    job and a business's other same-day jobs, so checkAvailability can
//    catch two bookings that are time-free but geographically impossible
//    (lib/messenger-scheduling.ts's documented v1 gap).
//
// Both are single HTTP calls with no SDK — matches this repo's existing
// pattern for third-party APIs (e.g. lib/sms.ts's MobileMessage calls).

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export type GeocodeResult = {
  lat: number;
  lng: number;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressPostcode: string | null;
};

function componentsFrom(components: { long_name: string; types: string[] }[], type: string): string | null {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

// Combines whatever street/suburb/postcode fields are known into one query
// string, biased to Australia (this app is AU-only per every other part of
// it — SMS sender ID, Brisbane timezone default, etc.) so a caller's
// suburb name doesn't get matched to a same-named suburb overseas.
export async function geocodeAddress(input: {
  addressStreet?: string | null;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
}): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[google-maps] GOOGLE_MAPS_API_KEY not set — skipping geocode.");
    return null;
  }
  const parts = [input.addressStreet, input.addressSuburb, input.addressPostcode].filter(Boolean);
  if (parts.length === 0) return null;

  const query = `${parts.join(", ")}, Australia`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&region=au&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) {
      console.error("[google-maps] geocode miss:", data.status, query);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components as { long_name: string; types: string[] }[];
    const streetNumber = componentsFrom(components, "street_number");
    const route = componentsFrom(components, "route");
    const addressStreet = [streetNumber, route].filter(Boolean).join(" ") || null;
    const addressSuburb =
      componentsFrom(components, "locality") ?? componentsFrom(components, "sublocality") ?? null;
    const addressPostcode = componentsFrom(components, "postal_code");

    // A street was given but Google couldn't actually match a route at that
    // address — it fell back to an approximate area-level match instead of
    // a real street match (confirmed on a genuinely bogus test address:
    // "OK" status, real lat/lng, but no route). That's not a validated
    // address, it's a guess at the suburb — treat it the same as a miss.
    if (input.addressStreet && !addressStreet) {
      console.error("[google-maps] geocode only matched at area level, no real street:", query);
      return null;
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      addressStreet,
      addressSuburb,
      addressPostcode,
    };
  } catch (err) {
    console.error("[google-maps] geocode request failed:", err);
    return null;
  }
}

// §42 — reverse geocoding (coords -> a short human-readable label), used
// only for the trip-log's "starting location" column. Best-effort: returns
// null on any failure rather than blocking the "On the way" notification
// this rides alongside.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;
    return data.results[0].formatted_address ?? null;
  } catch (err) {
    console.error("[google-maps] reverse geocode request failed:", err);
    return null;
  }
}

// §42 — single origin, single destination, both driving minutes AND
// distance in km from the one Distance Matrix call — used by the "On the
// way" notification (real ETA) and trip-km logging together, so that
// feature only ever needs one API call, not two.
export async function getDrivingInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ minutes: number; km: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const element = data.rows?.[0]?.elements?.[0];
    if (data.status !== "OK" || element?.status !== "OK" || !element.duration || !element.distance) {
      return null;
    }
    return {
      minutes: Math.round(element.duration.value / 60),
      km: Math.round((element.distance.value / 1000) * 10) / 10,
    };
  } catch (err) {
    console.error("[google-maps] distance matrix request failed:", err);
    return null;
  }
}

// One origin, many destinations, one request (Distance Matrix supports up
// to 25x25) — always batched against every same-day job in one call rather
// than one call per neighbour, since this runs inside a live phone call's
// tool round trip and every extra request is audible latency.
export async function getDrivingMinutesFromOrigin(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (!GOOGLE_MAPS_API_KEY || destinations.length === 0) {
    return destinations.map(() => null);
  }

  const originParam = `${origin.lat},${origin.lng}`;
  const destParam = destinations.map((d) => `${d.lat},${d.lng}`).join("|");
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
    originParam
  )}&destinations=${encodeURIComponent(destParam)}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.rows?.[0]?.elements) {
      console.error("[google-maps] distance matrix failed:", data.status);
      return destinations.map(() => null);
    }
    return data.rows[0].elements.map((el: { status: string; duration?: { value: number } }) =>
      el.status === "OK" && el.duration ? Math.round(el.duration.value / 60) : null
    );
  } catch (err) {
    console.error("[google-maps] distance matrix request failed:", err);
    return destinations.map(() => null);
  }
}

// §wrong-city-geocode — straight-line distance, not driving time: this is a
// cheap sanity check ("is this even the same part of the country?"), not a
// route calculation, so no API call needed. A real incident: a caller's
// suburb was misheard, and Google still matched a real street of the same
// name — just in a different city entirely (Parramatta NSW instead of
// Hervey Bay QLD) — because a genuine route match was trusted outright with
// no check on whether it was anywhere near the business's own area.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// A generous radius — big enough to cover any single trade business's real
// service area (even a wide rural one), small enough to still catch a
// same-country, wrong-city geocode like the Parramatta/Hervey Bay mix-up.
export const SERVICE_AREA_SANITY_RADIUS_KM = 150;
