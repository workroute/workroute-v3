"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ThreadRow = {
  job_id: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_block: "Morning" | "Afternoon" | "Evening" | null;
  customer_name: string;
  business_name: string;
  first_name: string | null;
  messages: { id: string; sender: "customer" | "ai" | "tradie"; body: string; created_at: string }[];
};

const POLL_INTERVAL_MS = 4000;

// §Messenger — simple polling, not websockets/Realtime, matching this
// codebase's consistent "simplest thing that works" bias. Reads go straight
// to the RPC from the browser (no secret involved — the token is the
// entire security boundary); only sending goes through the API route, since
// generating the AI reply needs a server-side key.
export default function MessengerChat({ token, initialThread }: { token: string; initialThread: ThreadRow }) {
  const [messages, setMessages] = useState(initialThread.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const supabase = createClient();
      const { data } = await supabase.rpc("messenger_get_thread", { p_token: token });
      const thread = data as ThreadRow | null;
      if (thread) setMessages(thread.messages);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, sender: "customer", body: text, created_at: new Date().toISOString() },
    ]);

    try {
      await fetch(`/api/messenger/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const supabase = createClient();
      const { data } = await supabase.rpc("messenger_get_thread", { p_token: token });
      const thread = data as ThreadRow | null;
      if (thread) setMessages(thread.messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.sender === "customer" ? "bg-amber-500 text-rig-950" : "bg-white text-rig-900"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-white px-3 py-2 text-sm text-rig-700/60 shadow-sm">
              …
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-rig-900/10 bg-white p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="field-input flex-1"
          placeholder="Type a message…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-4">
          Send
        </button>
      </form>
    </div>
  );
}
