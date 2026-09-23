import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_STYLES, PRIORITY_LABELS, PRIORITY_ORDER, type Priority } from "@/lib/attention";
import { initials } from "@/lib/avatar";

type LastMessage = { id: string; sender: "customer" | "ai" | "tradie"; body: string; created_at: string };

type ConversationRow = {
  id: string;
  customer_name: string;
  job_label: string | null;
  attention_priority: Priority | null;
  messages: LastMessage[];
};

const SENDER_PREFIX: Record<LastMessage["sender"], string> = {
  tradie: "You: ",
  ai: "AI: ",
  customer: "",
};

function formatTimestamp(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && then.toDateString() === new Date().toDateString()) return `${diffHr}h ago`;
  return then.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function preview(body: string): string {
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
}

// §32 — the real Messages inbox, replacing the "Coming soon" stub. One row
// per job that has at least one message. `messages!inner(...)` restricts to
// jobs with a message (inner join), and ordering + limiting the embedded
// resource per-foreign-table returns just the latest message per job in a
// single round trip — this is a per-job_id lookup, so the existing
// messages_job_id_created_at_idx index already serves it well; no new
// migration needed for this query shape.
export default async function MessagesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("jobs")
    .select("id, customer_name, job_label, attention_priority, messages!inner(id, sender, body, created_at)")
    .eq("business_id", user.id)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { foreignTable: "messages" });

  const conversations = (data ?? []) as ConversationRow[];

  const sorted = [...conversations].sort((a, b) => {
    const aFlagged = a.attention_priority !== null;
    const bFlagged = b.attention_priority !== null;
    if (aFlagged && bFlagged) {
      const order = PRIORITY_ORDER[a.attention_priority as Priority] - PRIORITY_ORDER[b.attention_priority as Priority];
      if (order !== 0) return order;
    } else if (aFlagged !== bFlagged) {
      return aFlagged ? -1 : 1;
    }
    return new Date(b.messages[0].created_at).getTime() - new Date(a.messages[0].created_at).getTime();
  });

  const flagged = sorted.filter((c) => c.attention_priority !== null);
  const recent = sorted.filter((c) => c.attention_priority === null);

  return (
    <main className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-rig-900">Messages</h1>
        <p className="mt-1 text-sm text-rig-700">Who needs your attention.</p>

        {sorted.length === 0 ? (
          <div className="mt-6 rounded-lg bg-white p-6 text-center shadow-sm">
            <p className="font-medium text-rig-900">No conversations yet</p>
            <p className="mt-1 text-sm text-rig-700">
              Messages from customers will show up here.
            </p>
          </div>
        ) : (
          <>
            {flagged.length > 0 && <ConversationGroup label="Needs Your Attention" conversations={flagged} />}
            {recent.length > 0 && <ConversationGroup label="Recent" conversations={recent} />}
          </>
        )}
      </div>
    </main>
  );
}

function ConversationGroup({ label, conversations }: { label: string; conversations: ConversationRow[] }) {
  return (
    <div className="mt-6 first:mt-4">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-steel-500">{label}</p>

      {/* §32 — mobile card list, matches jobs-table.tsx's convention */}
      <div className="space-y-3 sm:hidden">
        {conversations.map((c) => (
          <ConversationCard key={c.id} conversation={c} />
        ))}
      </div>

      <div className="hidden divide-y divide-rig-900/5 overflow-hidden rounded-lg border border-rig-900/10 bg-white shadow-sm sm:block">
        {conversations.map((c) => (
          <ConversationCard key={c.id} conversation={c} />
        ))}
      </div>
    </div>
  );
}

function ConversationCard({ conversation }: { conversation: ConversationRow }) {
  const last = conversation.messages[0];
  const priority = conversation.attention_priority;

  return (
    <Link
      href={`/app/messages/${conversation.id}`}
      className="block p-4 shadow-sm hover:bg-paper-100 sm:rounded-none sm:shadow-none rounded-lg border border-rig-900/10 bg-white sm:border-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-xs font-semibold text-rig-700">
            {initials(conversation.customer_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold text-rig-900">{conversation.customer_name}</p>
            {conversation.job_label && <p className="truncate text-xs text-rig-700/70">{conversation.job_label}</p>}
          </div>
        </div>
        {priority && (
          <span
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
          >
            {PRIORITY_LABELS[priority]}
          </span>
        )}
      </div>
      <p className="mt-1 truncate pl-[46px] text-sm text-rig-700">
        {SENDER_PREFIX[last.sender]}
        {preview(last.body)}
      </p>
      <p className="mt-1 pl-[46px] text-xs text-rig-700/50">{formatTimestamp(last.created_at)}</p>
    </Link>
  );
}
