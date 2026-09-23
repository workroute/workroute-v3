// WorkRoute Messenger AI test suite — the reusable version of the one-off
// scripts used to find and verify the fixes to lib/messenger-ai.ts's
// Low/Medium classification. Hits the real running app (npm run dev must be
// running on :3000), not isolated functions — this tests the actual route
// handler, RPC calls, and DB triggers, not a mock of them.
//
// Every job this creates is thrown away at the end (customer_name prefixed
// "TEST_", deleted via try/finally even on failure) — it never touches your
// real jobs/clients. Costs real Anthropic + (for scenario 2) real SMS calls.
//
// Usage:
//   node scripts/test-messenger-ai.mjs                  run everything once
//   node scripts/test-messenger-ai.mjs --only=4,5        just those scenarios
//   node scripts/test-messenger-ai.mjs --only=4,5 --repeat=5
//     run scenarios 4 and 5 five times each — LLM behavior is probabilistic,
//     so a single pass doesn't prove consistency. Use this before trusting a
//     prompt change, especially around the Low/Medium/High boundary.
//
// Scenario 2 (high-priority) sends a real SMS to the business's own phone
// each time it runs — keep --repeat low for that one, or exclude it with
// --only when iterating on other scenarios.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "http://localhost:3000";
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- CLI args -----------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;
const repeat = args.repeat ? parseInt(args.repeat, 10) : 1;

// --- Shared helpers -------------------------------------------------------

async function findBusinessId() {
  const { data } = await supabase.from("business_profiles").select("user_id").limit(1).single();
  return data.user_id;
}

async function createJob(businessId, overrides = {}) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      source: "form",
      customer_name: overrides.customer_name ?? "TEST_customer",
      confidence: "High",
      status: overrides.status ?? "Scheduled",
      scheduled_date: overrides.scheduled_date ?? null,
      scheduled_time: overrides.scheduled_time ?? null,
    })
    .select("id, customer_access_token")
    .single();
  if (error) throw new Error(`createJob failed: ${error.message}`);
  return data;
}

async function deleteJob(id) {
  await supabase.from("jobs").delete().eq("id", id);
}

async function send(token, message) {
  const res = await fetch(`${BASE}/api/messenger/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function getJob(id) {
  const { data } = await supabase
    .from("jobs")
    .select("status, scheduled_date, scheduled_time, ai_paused, attention_priority")
    .eq("id", id)
    .single();
  return data;
}

async function getMessages(jobId) {
  const { data } = await supabase
    .from("messages")
    .select("sender, body, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

function containsWorkRouteLeak(text) {
  return /workroute|as an ai|i'?m an ai|i am an ai/i.test(text ?? "");
}

// --- Scenarios ------------------------------------------------------------
// Each returns { pass: boolean, detail: string }. Each owns creating and
// deleting whatever jobs it needs — one run must never depend on state left
// by another.

const SCENARIOS = {
  "1": {
    name: "Basic customer reply",
    async run(businessId) {
      const job = await createJob(businessId, { customer_name: "TEST_1_basic" });
      try {
        const r = await send(job.customer_access_token, "Thanks so much for the great work today!");
        const after = await getJob(job.id);
        const msgs = await getMessages(job.id);
        const ai = [...msgs].reverse().find((m) => m.sender === "ai");
        const pass = r.status === 200 && !!ai && !containsWorkRouteLeak(ai.body) && after.attention_priority === null;
        return { pass, detail: `attention_priority=${after.attention_priority}, reply="${ai?.body}"` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "2": {
    name: "High-priority alert (sends a real SMS each run — keep --repeat low)",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_2_urgent",
        scheduled_date: "2026-09-01",
        scheduled_time: "09:00:00",
      });
      try {
        const r = await send(
          job.customer_access_token,
          "Emergency — water is flooding through the ceiling right now, I need someone urgently!"
        );
        const after = await getJob(job.id);
        const pass = r.status === 200 && after.attention_priority === "high";
        return { pass, detail: `attention_priority=${after.attention_priority}` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "3": {
    name: "Successful reschedule",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_3_reschedule",
        scheduled_date: "2026-09-02",
        scheduled_time: "10:00:00",
      });
      try {
        const r = await send(job.customer_access_token, "Could we do 11am on the 3rd of September instead?");
        const after = await getJob(job.id);
        const moved = after.scheduled_date === "2026-09-03" && after.scheduled_time?.slice(0, 5) === "11:00";
        const pass = r.status === 200 && moved && after.attention_priority === null;
        return { pass, detail: `moved=${moved} (now ${after.scheduled_date} ${after.scheduled_time}), attention_priority=${after.attention_priority}` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "4": {
    name: "Conflicting reschedule",
    async run(businessId) {
      const anchor = await createJob(businessId, {
        customer_name: "TEST_4_anchor",
        scheduled_date: "2026-09-05",
        scheduled_time: "09:00:00",
      });
      const actor = await createJob(businessId, {
        customer_name: "TEST_4_actor",
        scheduled_date: "2026-09-06",
        scheduled_time: "14:00:00",
      });
      try {
        const before = await getJob(actor.id);
        const r = await send(actor.customer_access_token, "Any chance you could come at 9am on the 5th of September instead?");
        const after = await getJob(actor.id);
        const unchanged = after.scheduled_date === before.scheduled_date && after.scheduled_time === before.scheduled_time;
        const pass = r.status === 200 && unchanged && after.attention_priority === "medium";
        return { pass, detail: `unchanged=${unchanged}, attention_priority=${after.attention_priority} (want "medium")` };
      } finally {
        await deleteJob(anchor.id);
        await deleteJob(actor.id);
      }
    },
  },

  "5": {
    name: "Low-priority open question",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_5_lowprio",
        scheduled_date: "2026-09-10",
        scheduled_time: "10:00:00",
      });
      try {
        const r = await send(
          job.customer_access_token,
          "No rush at all, but roughly how much does a lawn mowing visit usually cost?"
        );
        const after = await getJob(job.id);
        const pass = r.status === 200 && after.attention_priority === "low";
        return { pass, detail: `attention_priority=${after.attention_priority} (want "low")` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "6": {
    name: "Tradie takes over / AI stays paused",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_6_takeover",
        scheduled_date: "2026-09-11",
        scheduled_time: "10:00:00",
      });
      try {
        await send(job.customer_access_token, "Could you come earlier, maybe 9am?");
        await supabase.from("messages").insert({
          job_id: job.id,
          business_id: businessId,
          sender: "tradie",
          body: "I'll message the customer myself on this one.",
        });
        const afterTradieReply = await getJob(job.id);
        const aiCountBefore = (await getMessages(job.id)).filter((m) => m.sender === "ai").length;

        const r = await send(job.customer_access_token, "Great, thanks!");
        const aiCountAfter = (await getMessages(job.id)).filter((m) => m.sender === "ai").length;
        const afterJob = await getJob(job.id);

        const pass =
          afterTradieReply.ai_paused === true &&
          r.status === 200 &&
          aiCountAfter === aiCountBefore &&
          afterJob.ai_paused === true;
        return {
          pass,
          detail: `ai_paused after tradie reply=${afterTradieReply.ai_paused}, ai messages before/after next customer msg=${aiCountBefore}/${aiCountAfter}, still paused=${afterJob.ai_paused}`,
        };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "7a": {
    name: "Security — valid-shaped but non-existent token",
    async run() {
      const r = await send("00000000-0000-0000-0000-000000000000", "hello?");
      return { pass: r.status === 404, detail: `status=${r.status}` };
    },
  },

  "7b": {
    name: "Security — malformed token rejected before DB hit",
    async run() {
      const r = await send("not-a-uuid-at-all", "hello?");
      return { pass: r.status === 400, detail: `status=${r.status}` };
    },
  },

  "7c": {
    name: "Security — throttle after 10 messages in 5 minutes",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_7c_throttle",
        scheduled_date: "2026-09-12",
        scheduled_time: "10:00:00",
      });
      try {
        let last;
        for (let i = 1; i <= 11; i++) {
          last = await send(job.customer_access_token, `test message ${i}`);
        }
        return { pass: last.status === 429, detail: `11th message status=${last.status}` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },

  "8": {
    name: "No invented scheduling facts on an ambiguous ask",
    async run(businessId) {
      const job = await createJob(businessId, {
        customer_name: "TEST_8_ambiguous",
        scheduled_date: "2026-09-15",
        scheduled_time: "10:00:00",
      });
      try {
        const before = await getJob(job.id);
        const r = await send(job.customer_access_token, "Is next Tuesday any good for you?");
        const after = await getJob(job.id);
        const pass = r.status === 200 && after.scheduled_date === before.scheduled_date;
        return { pass, detail: `date unchanged=${after.scheduled_date === before.scheduled_date} (still ${after.scheduled_date})` };
      } finally {
        await deleteJob(job.id);
      }
    },
  },
};

// --- Runner -----------------------------------------------------------

async function main() {
  const businessId = await findBusinessId();
  const keys = only ?? Object.keys(SCENARIOS);

  console.log(`Running ${keys.length} scenario(s), ${repeat}x each, against ${BASE}\n`);

  const summary = [];

  for (const key of keys) {
    const scenario = SCENARIOS[key];
    if (!scenario) {
      console.log(`Unknown scenario "${key}" — skipping. Known: ${Object.keys(SCENARIOS).join(", ")}`);
      continue;
    }

    let passCount = 0;
    for (let i = 1; i <= repeat; i++) {
      const label = repeat > 1 ? ` (run ${i}/${repeat})` : "";
      try {
        const { pass, detail } = await scenario.run(businessId);
        if (pass) passCount++;
        console.log(`${pass ? "PASS" : "FAIL"} — ${key}. ${scenario.name}${label}\n  ${detail}\n`);
      } catch (error) {
        console.log(`FAIL — ${key}. ${scenario.name}${label}\n  threw: ${error.message}\n`);
      }
    }
    summary.push({ key, name: scenario.name, passCount, repeat });
  }

  console.log("=== SUMMARY ===");
  let anyFail = false;
  for (const s of summary) {
    const ok = s.passCount === s.repeat;
    if (!ok) anyFail = true;
    console.log(`${ok ? "✅" : "❌"} ${s.key}. ${s.name} — ${s.passCount}/${s.repeat}`);
  }

  process.exit(anyFail ? 1 : 0);
}

main();
