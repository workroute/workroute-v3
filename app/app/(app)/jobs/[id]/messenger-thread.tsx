"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveKnowledge } from "@/lib/ai-knowledge";

export type ThreadMessage = { id: string; sender: "customer" | "ai" | "tradie"; body: string; created_at: string };

type ReviewCandidate = { customerMessage: string; aiReply: string | null; resolution: string };

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// §Messenger — the tradie's own view of a job's conversation, reachable
// from the job detail page. Sending here goes through the normal
// RLS-scoped browser client (sender: "tradie"), same as everything else in
// this app — no service role needed on this path. A DB trigger (0007
// migration) pauses the AI on this job the moment this insert lands.
//
// AI Knowledge: if this reply resolves a job that was flagged for
// attention, it's the natural moment to offer saving it as a reusable
// example — practical, owner-curated, not machine-learning retraining.
export default function MessengerThread({
  jobId,
  businessId,
  initialMessages,
  wasFlagged,
}: {
  jobId: string;
  businessId: string;
  initialMessages: ThreadMessage[];
  wasFlagged: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<ReviewCandidate | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ job_id: jobId, business_id: businessId, sender: "tradie", body: text })
      .select()
      .single();

    if (!error && data) {
      if (wasFlagged && !reviewCandidate) {
        const lastCustomer = [...messages].reverse().find((m) => m.sender === "customer");
        const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
        if (lastCustomer) {
          setReviewCandidate({
            customerMessage: lastCustomer.body,
            aiReply: lastAi?.body ?? null,
            resolution: text,
          });
        }
      }
      setMessages((prev) => [...prev, data as ThreadMessage]);
      setInput("");
      fetch("/api/messenger/notify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {}); // resilience — never blocks the send UI on a push failure
    }
    setSending(false);
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-steel-500">Messenger</p>

      {messages.length === 0 ? (
        <p className="text-sm text-rig-700/60">No messages yet.</p>
      ) : (
        <div className="mb-4 max-h-96 space-y-2 overflow-y-auto">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDivider = !prev || dayKey(m.created_at) !== dayKey(prev.created_at);
            return (
              <div key={m.id}>
                {showDivider && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-paper-100 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rig-700/50">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${m.sender === "customer" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.sender === "customer" ? "bg-paper-100 text-rig-900" : "bg-amber-500/15 text-rig-900"
                    }`}
                  >
                    <p>{m.body}</p>
                    {m.sender === "ai" && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-rig-700/50">Auto-reply</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewCandidate && (
        <KnowledgeReview
          jobId={jobId}
          businessId={businessId}
          candidate={reviewCandidate}
          onDone={() => setReviewCandidate(null)}
        />
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="field-input flex-1"
          placeholder="Reply as yourself — pauses automatic replies for this job"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-4">
          Send
        </button>
      </form>
    </div>
  );
}

function KnowledgeReview({
  jobId,
  businessId,
  candidate,
  onDone,
}: {
  jobId: string;
  businessId: string;
  candidate: ReviewCandidate;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(candidate.resolution);
  const [saving, setSaving] = useState(false);

  async function save(rating: "good" | "improved", resolution: string) {
    setSaving(true);
    const supabase = createClient();
    await saveKnowledge(supabase, {
      businessId,
      jobId,
      customerMessage: candidate.customerMessage,
      aiReply: candidate.aiReply,
      resolution,
      rating,
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="mb-4 rounded-lg border border-steel-500/20 bg-steel-500/5 p-3">
      <p className="text-xs font-medium text-rig-900">Save this as an example for the AI?</p>
      <p className="mt-1 text-xs text-rig-700/70">
        Helps it handle similar questions the same way next time.
      </p>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="field-input min-h-[60px] text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !editedText.trim()}
              onClick={() => save("improved", editedText.trim())}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-700 hover:bg-paper-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save("good", candidate.resolution)}
            className="rounded border border-moss-500/40 bg-moss-500/10 px-3 py-1.5 text-xs font-medium text-moss-500 hover:bg-moss-500/15"
          >
            ✓ Good response
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setEditing(true)}
            className="rounded border border-rig-700/20 bg-white px-3 py-1.5 text-xs font-medium text-rig-700 hover:bg-paper-100"
          >
            Improve response
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDone}
            className="px-3 py-1.5 text-xs font-medium text-rig-700/60 hover:text-rig-700"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
