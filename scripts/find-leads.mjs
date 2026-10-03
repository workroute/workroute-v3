// Lead finder: searches Google Places (New) for tradies in a suburb and
// writes a CSV in the same column order as "WorkRoute call list.xlsx", so it
// can be pasted straight into that sheet.
//
// Usage (Node 18+):
//   GOOGLE_MAPS_API_KEY=xxx node scripts/find-leads.mjs "plumber" "Hervey Bay QLD"
//   GOOGLE_MAPS_API_KEY=xxx node scripts/find-leads.mjs "electrician" "Maryborough QLD" --max 40
//
// Needs "Places API (New)" enabled on the same Google Cloud project as the
// existing key. Phone numbers put each request in Google's higher-priced
// "Enterprise" SKU, so keep --max small and check the free monthly credit.
//
// Keeps only businesses that are open, have a phone number, and have NO
// website listed (the likeliest to need a missed-call answerer and to lack
// their own booking page). Pass --keep-websites to include those too.
// This is a call-sheet builder for manual calls only, it does no outreach.

import { writeFileSync } from "node:fs";

const [query, area, ...flags] = process.argv.slice(2);
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key || !query || !area) {
  console.error('Usage: GOOGLE_MAPS_API_KEY=... node scripts/find-leads.mjs "<trade>" "<suburb or town>" [--max N] [--keep-websites]');
  process.exit(1);
}
const max = Number(flags[flags.indexOf("--max") + 1]) || 40;
const keepWebsites = flags.includes("--keep-websites");

const FIELDS = [
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.userRatingCount",
  "places.rating",
  "places.shortFormattedAddress",
  "places.businessStatus",
].join(",");

async function searchPage(pageToken) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS + ",nextPageToken",
    },
    body: JSON.stringify({
      textQuery: `${query} in ${area}`,
      regionCode: "AU",
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  return res.json();
}

const found = [];
let token;
do {
  const data = await searchPage(token);
  found.push(...(data.places ?? []));
  token = data.nextPageToken;
} while (token && found.length < max);

const leads = found.filter(
  (p) =>
    p.businessStatus === "OPERATIONAL" &&
    p.nationalPhoneNumber &&
    (keepWebsites || !p.websiteUri)
);

// Suburb is the last comma part of Google's short address
// ("12 Smith St, Scarness" -> "Scarness"); falls back to the search area.
const suburbOf = (p) => (p.shortFormattedAddress?.split(",").pop() ?? area).trim();
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const header = ["#", "Day", "Business", "Trade", "Phone", "Suburb", "Reviews", "Called at", "Answered?", "Texted?", "Replied?", "Demo booked?", "Notes"];
const rows = leads.map((p, i) => [
  i + 1, "", p.displayName?.text, query, p.nationalPhoneNumber, suburbOf(p),
  p.userRatingCount ?? "", "", "", "", "", "", p.websiteUri ? "has website" : "no website",
]);

const file = `leads-${query.replace(/\W+/g, "-")}-${area.replace(/\W+/g, "-")}.csv`.toLowerCase();
writeFileSync(file, [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"));
console.log(`${found.length} found, ${leads.length} kept -> ${file}`);
