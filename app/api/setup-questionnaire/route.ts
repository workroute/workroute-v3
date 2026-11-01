import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyAdminOfSalesLead } from "@/lib/push-notifications";
import { sendSetupAnswersEmail } from "@/lib/resend";
import { sanitizeSetupAnswers } from "@/lib/setup-questionnaire";

// §setup-questionnaire — the public endpoint behind app/setup. A tradie fills
// in the questions Sarah needs (prices, hours, area, voice) and the answers
// are emailed to the owner, who enters them into Settings for them. Also saved
// as a lead (workroute_sales_leads) so it shows in Owner Overview > Website
// leads and the owner gets the usual push. Public and unauthenticated, so it
// is rate limited per mobile number and overall using the leads table itself,
// the same approach as app/api/missed-call-report.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTES_PREFIX = "Setup questionnaire";
const SAME_MOBILE_WINDOW_MS = 10 * 60 * 1000;
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

  const answers = sanitizeSetupAnswers(body.answers);
  if (!answers.name) return json({ ok: false, error: "Please add your first name." }, 400);
  if (!answers.business) return json({ ok: false, error: "Please add your business name." }, 400);
  if (!answers.trade) return json({ ok: false, error: "Please choose your trade." }, 400);
  if (answers.mobile.replace(/\D/g, "").length < 8) {
    return json({ ok: false, error: "That mobile number doesn't look right. Please check it." }, 400);
  }
  if (answers.email && !EMAIL_RE.test(answers.email)) {
    return json({ ok: false, error: "That email doesn't look right. Please check it or leave it blank." }, 400);
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();

  const [{ count: sameMobile }, { count: overall }] = await Promise.all([
    supabase
      .from("workroute_sales_leads")
      .select("id", { count: "exact", head: true })
      .eq("phone", answers.mobile)
      .like("notes", `${NOTES_PREFIX}%`)
      .gte("created_at", new Date(now - SAME_MOBILE_WINDOW_MS).toISOString()),
    supabase
      .from("workroute_sales_leads")
      .select("id", { count: "exact", head: true })
      .like("notes", `${NOTES_PREFIX}%`)
      .gte("created_at", new Date(now - OVERALL_WINDOW_MS).toISOString()),
  ]);
  if ((sameMobile ?? 0) > 0) {
    return json({ ok: false, error: "We've just received your answers. Steve will be in touch shortly." }, 429);
  }
  if ((overall ?? 0) >= OVERALL_MAX) {
    return json({ ok: false, error: "Lots of answers coming in right now. Please try again in a little while." }, 429);
  }

  const sent = await sendSetupAnswersEmail(answers);
  if (!sent.ok) {
    console.error("[setup-questionnaire] email failed —", sent.error);
    return json({ ok: false, error: "Your answers didn't send. Please try again in a moment." }, 502);
  }

  const notes = `${NOTES_PREFIX}: ${answers.trade}. Answers emailed.`;
  const { error: saveError } = await supabase.from("workroute_sales_leads").insert({
    session_id: crypto.randomUUID(),
    name: answers.name,
    business: answers.business,
    phone: answers.mobile,
    ...(answers.email ? { email: answers.email } : {}),
    notes,
  });
  if (saveError) console.error("[setup-questionnaire] saving lead failed —", JSON.stringify(saveError));

  // The tradie's answers have already reached the owner by email — a failed
  // push shouldn't turn into an error on their screen.
  await Promise.allSettled([
    notifyAdminOfSalesLead(supabase, answers.name, new URL(request.url).origin, "setup questionnaire"),
  ]);

  return json({ ok: true });
}
