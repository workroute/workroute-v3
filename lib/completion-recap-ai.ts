import Anthropic from "@anthropic-ai/sdk";

// §39 — turns the tradie's spoken job recap into a short customer-facing
// summary plus a total. One-shot, no conversation state (unlike
// phone-ai/messenger-ai/widget-ai) — the tradie reviews and can edit both
// fields before anything is ever sent, so this only has to get close, not
// be perfectly reliable.
const MODEL = "claude-sonnet-5";

const TOOL: Anthropic.Tool = {
  name: "record_completion_recap",
  description: "Record the completion summary and total price to charge, based on what the tradie said.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "A short, friendly, plain-English summary of what was done on the job, written to the customer (not the tradie) — 1-3 sentences. Mention anything extra done or still needed, if the tradie brought it up. This is sent together with the invoice number and total below it, so it IS the invoice notice — never phrase it as \"ready to invoice\" or \"will be invoiced,\" since that reads as the bill still being on its way when it's actually right there.",
      },
      total: {
        type: "number",
        description: "The total amount to charge the customer for this job, in dollars.",
      },
      // §next-visit-on-completion — only ever an offer to check, never a
      // silent booking: the actual create-the-job step always re-checks real
      // availability and shows the tradie the exact date before it commits
      // (see book-next-visit/route.ts) — this just captures the intent and a
      // best-effort date so there's nothing left to re-type by hand.
      nextVisitRequested: {
        type: "boolean",
        description:
          "True only if the tradie clearly said to book/lock in the customer's next visit while recording this recap (e.g. \"book them in for a fortnight,\" \"same time next month\"). False if they didn't mention a next visit at all, or only vaguely said the customer wants one 'sometime' without giving anything to go on.",
      },
      nextVisitDate: {
        type: "string",
        description:
          "Only when nextVisitRequested is true and a real date can be worked out — YYYY-MM-DD. Resolve relative phrases (\"in a fortnight,\" \"same time next month\") against today's date and this job's own date, given below. Omit entirely if requested but genuinely too vague to resolve to an actual date.",
      },
      nextVisitTime: {
        type: "string",
        description:
          "Only if the tradie mentioned a specific time for the next visit — HH:MM 24-hour. Omit if they didn't say one (the app falls back to this job's own time).",
      },
    },
    required: ["summary", "total", "nextVisitRequested"],
  },
};

export async function draftCompletionRecap(
  transcript: string,
  context: {
    customerName: string;
    jobLabel: string | null;
    quotedPrice: number | null;
    scheduledDate: string | null;
    scheduledTime: string | null;
  }
): Promise<
  | {
      ok: true;
      summary: string;
      total: number;
      nextVisitRequested: boolean;
      nextVisitDate: string | null;
      nextVisitTime: string | null;
    }
  | { ok: false; error: string }
> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const system = `A tradie just finished a job for ${context.customerName}${
    context.jobLabel ? ` (${context.jobLabel})` : ""
  } and recorded a quick voice note about what they did. The original quoted price was ${
    context.quotedPrice !== null ? `$${context.quotedPrice.toFixed(2)}` : "not set"
  }. Today is ${today}. This job was originally scheduled for ${context.scheduledDate ?? "an unknown date"}${
    context.scheduledTime ? ` at ${context.scheduledTime}` : ""
  }.

Turn their spoken note into a short summary written TO the customer, and work out the total to charge — start from the quoted price and only change it if the tradie clearly mentions extra or less work. If they don't mention price at all, use the quoted price unchanged.

Separately, listen for whether the tradie also asked to book the customer's next visit while talking — people often do this in the same breath as the recap ("book them in for a fortnight," "same time next month"). If so, set nextVisitRequested true and resolve whatever timing they gave into a real date using today's date and this job's own date above. Always call record_completion_recap with your result.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_completion_recap" },
      messages: [{ role: "user", content: transcript }],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return { ok: false, error: "Couldn't work out a summary from that recording." };
    }

    const input = block.input as {
      summary?: string;
      total?: number;
      nextVisitRequested?: boolean;
      nextVisitDate?: string;
      nextVisitTime?: string;
    };
    if (!input.summary || typeof input.total !== "number") {
      return { ok: false, error: "Couldn't work out a summary from that recording." };
    }

    return {
      ok: true,
      summary: input.summary,
      total: input.total,
      nextVisitRequested: !!input.nextVisitRequested,
      nextVisitDate: input.nextVisitDate ?? null,
      nextVisitTime: input.nextVisitTime ?? null,
    };
  } catch {
    return { ok: false, error: "Couldn't reach the AI to summarise that recording." };
  }
}
