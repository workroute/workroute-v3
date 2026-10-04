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
//
// --exclude <file> skips numbers already on your sheet. The file can be any
// CSV or text export (save the call list as CSV from Excel); every phone-like
// number in it is skipped, matched on its last 9 digits so "0481 867 669",
// "+61 481 867 669" and "(04) 8186 7669" all count as the same number.
// This is a call-sheet builder for manual calls only, it does no outreach.

import { readFileSync, writeFileSync } from "node:fs";

const [query, area, ...flags] = process.argv.slice(2);
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key || !query || !area) {
  console.error('Usage: GOOGLE_MAPS_API_KEY=... node scripts/find-leads.mjs "<trade>" "<suburb or town>" [--max N] [--keep-websites] [--exclude file.csv]');
  process.exit(1);
}
const max = Number(flags[flags.indexOf("--max") + 1]) || 40;
const keepWebsites = flags.includes("--keep-websites");

const last9 = (s) => s.replace(/\D/g, "").slice(-9);
const excludeFile = flags.includes("--exclude") ? flags[flags.indexOf("--exclude") + 1] : null;
const excluded = new Set();
if (excludeFile) {
  const text = readFileSync(excludeFile, "utf8");
  for (const m of text.matchAll(/\+?\(?\d[\d\s()-]{7,}\d/g)) excluded.add(last9(m[0]));
  console.log(`Excluding ${excluded.size} numbers from ${excludeFile}`);
}

const FIELDS = [
  "places.id",
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

// Google can keep handing back a next-page token while re-sending the same
// places, so dedupe by place id and stop the moment a page adds nothing new.
const byId = new Map();
let token;
let pages = 0;
do {
  const data = await searchPage(token);
  const before = byId.size;
  for (const p of data.places ?? []) byId.set(p.id, p);
  token = byId.size > before ? data.nextPageToken : undefined;
  pages++;
} while (token && byId.size < max && pages < 10);
const found = [...byId.values()];

const leads = found.filter(
  (p) =>
    p.businessStatus === "OPERATIONAL" &&
    p.nationalPhoneNumber &&
    (keepWebsites || !p.websiteUri) &&
    !excluded.has(last9(p.nationalPhoneNumber))
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
