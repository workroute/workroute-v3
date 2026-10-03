import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyAdminOfSalesLead } from "@/lib/push-notifications";
import { sendMissedCallReportEmail, sendSalesLeadEmail } from "@/lib/resend";
import {
  calculateMissedCallCost,
  formatCount,
  formatDollars,
  sanitizeInputs,
  WORKROUTE_DEMO_PHONE,
  WORKROUTE_SIGNUP_URL,
} from "@/lib/missed-call-cost";

// §missed-call report — the public endpoint behind app/missed-calls. A tradie
// who's used the calculator leaves their name and email, gets their report by
// email, and lands in workroute_sales_leads (Owner Overview > Website leads)
// with Steve getting the usual lead email + push. Public and unauthenticated,
// and it sends email to whatever address is typed in, so it's rate limited
// per address and overall using the leads table itself.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTES_PREFIX = "Missed-call report";
const SAME_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const OVERALL_WINDOW_MS = 60 * 60 * 1000;
const OVERALL_MAX = 30;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ ok: false, error: "Something went wrong. Please try again." }, 400);

  // Hidden field real people never fill in — bots that do get a fake success.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const business = typeof body.business === "string" ? body.business.trim().slice(0, 150) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
  if (!name) return json({ ok: false, error: "Please add your first name." }, 400);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "That email doesn't look right. Please check it." }, 400);

  const inputs = sanitizeInputs(body.inputs);
  const supabase = createServiceRoleClient();
  const now = Date.now();

  const [{ count: sameEmail }, { count: overall }] = await Promise.all([
    supabase
      .from("workroute_sales_leads")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .like("notes", `${NOTES_PREFIX}%`)
      .gte("created_at", new Date(now - SAME_EMAIL_WINDOW_MS).toISOString()),
    supabase
      .from("workroute_sales_leads")
      .select("id", { count: "exact", head: true })
      .like("notes", `${NOTES_PREFIX}%`)
      .gte("created_at", new Date(now - OVERALL_WINDOW_MS).toISOString()),
  ]);
  if ((sameEmail ?? 0) > 0) {
    return json({ ok: false, error: "We've just sent a report to that email. Check your inbox (and junk folder)." }, 429);
  }
  if ((overall ?? 0) >= OVERALL_MAX) {
    return json({ ok: false, error: "Lots of reports going out right now. Please try again in a little while." }, 429);
  }

  const sent = await sendMissedCallReportEmail(email, name, inputs, WORKROUTE_DEMO_PHONE, WORKROUTE_SIGNUP_URL);
  if (!sent.ok) {
    console.error("[missed-call-report] report email failed —", sent.error);
    return json({ ok: false, error: "The email didn't send. Please check the address and try again." }, 502);
  }

  const r = calculateMissedCallCost(inputs);
  const notes =
    `${NOTES_PREFIX}: about ${formatDollars(r.lostPerYear)}/year lost ` +
    `(${formatCount(inputs.callsPerWeek)} calls/wk, ${inputs.missedPct}% missed, ` +
    `${formatDollars(inputs.jobValue)} avg job, ${formatCount(inputs.jobsPerYear)}x/yr). Report emailed.`;
  const prospect = { name, email, notes, ...(business ? { business } : {}), ...(phone ? { phone } : {}) };

  const { error: saveError } = await supabase.from("workroute_sales_leads").insert({
    session_id: crypto.randomUUID(),
    ...prospect,
  });
  if (saveError) console.error("[missed-call-report] saving lead failed —", JSON.stringify(saveError));

  // The visitor already has their report — a failed heads-up to Steve
  // shouldn't turn into an error on their screen.
  const [, leadEmail] = await Promise.allSettled([
    notifyAdminOfSalesLead(supabase, name, new URL(request.url).origin, "missed-call report"),
    sendSalesLeadEmail(prospect, [], "missed-call report"),
  ]);
  if (leadEmail.status === "rejected" || !leadEmail.value.ok) {
    console.error("[missed-call-report] lead email failed —", leadEmail.status === "fulfilled" ? leadEmail.value.error : leadEmail.reason);
  }

  return json({ ok: true });
}
