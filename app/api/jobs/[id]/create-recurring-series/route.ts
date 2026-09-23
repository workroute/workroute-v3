import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRecurringSeries, type RecurringFrequency } from "@/lib/recurring-jobs";

const FREQUENCIES: RecurringFrequency[] = ["Weekly", "Fortnightly", "Monthly"];

// §manual-recurring — lets a tradie mark a manually-captured job as a
// regular/repeat service, reusing the exact same series-generation logic
// Emma already applies when a caller books a recurring visit on a call
// (lib/recurring-jobs.ts's createRecurringSeries) — one series-building
// implementation, not a second one duplicated for manual entry.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const frequency = body?.frequency;
  const date: string | undefined = body?.date;
  const time: string | null = body?.time ?? null;
  const block: "Morning" | "Afternoon" | "Evening" | null = body?.block ?? null;

  if (!FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ ok: false, error: "Invalid frequency." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ ok: false, error: "Missing date." }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", params.id)
    .eq("business_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  const result = await createRecurringSeries(supabase, user.id, params.id, date, time, block, frequency);

  if (!result) {
    return NextResponse.json({ ok: false, error: "Couldn't create the recurring series." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
