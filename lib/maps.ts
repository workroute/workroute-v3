// §32c — zero-cost "Open in Google Maps" multi-stop link. No API key, no
// routing computation on our side, no dependency: just a standard Google
// Maps URL. Google's own app handles the actual navigation, traffic, and
// lets the tradie freely reorder stops within an interface they already
// know. Deliberately not real route optimization (§32b keeps that deferred).
import type { Job } from "./run-sheet";

type AddressLike = Pick<Job, "address_street" | "address_suburb" | "address_postcode">;

function addressOf(job: AddressLike): string | null {
  const parts = [job.address_street, job.address_suburb, job.address_postcode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildGoogleMapsUrl(jobs: AddressLike[]): string | null {
  const addresses = jobs.map(addressOf).filter((a): a is string => a !== null);
  if (addresses.length === 0) return null;

  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(0, -1);

  const params = new URLSearchParams({ api: "1", destination });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// §Google Maps integration — the visual counterpart to buildGoogleMapsUrl
// above: an at-a-glance embedded map on the run sheet itself (pins + route
// line), not a navigation tool. The actual drive still hands off to
// Google's own app via the link above — this only ever renders a static
// embedded iframe, no turn-by-turn, no live traffic, nothing WorkRoute has
// to maintain. Uses each job's lat/lng (from phone-AI geocoding) when
// available — more precise than re-geocoding address text, and works even
// for an address whose text alone would be ambiguous — falling back to the
// address string for older/manually-entered jobs that predate geocoding.
//
// Deliberately takes the API key as a parameter rather than reading
// process.env itself: this URL ends up directly in rendered page HTML (an
// iframe src), so the key it contains must be the separate, HTTP-referrer-
// restricted NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — never the unrestricted
// server-only GOOGLE_MAPS_API_KEY used for geocoding/distance-matrix calls.
type GeoAddressLike = AddressLike & Pick<Job, "latitude" | "longitude">;

function locationOf(job: GeoAddressLike): string | null {
  if (job.latitude != null && job.longitude != null) return `${job.latitude},${job.longitude}`;
  return addressOf(job);
}

export function buildGoogleMapsEmbedUrl(jobs: GeoAddressLike[], apiKey: string): string | null {
  const locations = jobs.map(locationOf).filter((l): l is string => l !== null);
  if (locations.length === 0) return null;

  if (locations.length === 1) {
    return `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key: apiKey, q: locations[0] })}`;
  }

  const origin = locations[0];
  const destination = locations[locations.length - 1];
  const waypoints = locations.slice(1, -1);

  const params = new URLSearchParams({ key: apiKey, origin, destination, mode: "driving" });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}
