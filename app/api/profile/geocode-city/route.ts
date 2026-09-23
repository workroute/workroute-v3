import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/google-maps";

// §wrong-city-geocode — geocodes the business's own city once per save, so
// lib/phone-ai.ts has a fixed reference point to sanity-check new job
// addresses against (see haversineKm/SERVICE_AREA_SANITY_RADIUS_KM in
// lib/google-maps.ts). Best-effort: a failed/missing geocode here just
// means the sanity check is skipped later, not that profile saving fails.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const city = typeof body?.city === "string" ? body.city.trim() : "";

  if (!city) {
    return NextResponse.json({ ok: true, geocoded: false });
  }

  const geocoded = await geocodeAddress({ addressSuburb: city });

  if (!geocoded) {
    return NextResponse.json({ ok: true, geocoded: false });
  }

  await supabase
    .from("business_profiles")
    .update({ service_center_lat: geocoded.lat, service_center_lng: geocoded.lng })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, geocoded: true });
}
