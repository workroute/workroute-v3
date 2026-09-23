"use client";

import { useEffect, useRef, useState } from "react";

type Message = { sender: "visitor" | "ai"; body: string };

// AI-generated (per the business owner, made with ChatGPT) — not a photo of
// a real person, and it's their own generated asset, not scraped stock
// photography. Object-position focuses on the face since the source image
// includes shoulders/arms that get cropped out at the small avatar sizes
// this is used at.
function SarahAvatar({ className }: { className?: string }) {
  return (
    <img
      src="/sarah-avatar.png"
      alt="Sarah"
      className={`object-cover object-top ${className ?? ""}`}
    />
  );
}

const RESIZE_MESSAGE_TYPE = "workroute-widget-resize";

// Scoped by widgetKey, not a single shared key — this iframe's origin is
// the same (ours) regardless of which tradie's site it's embedded on, so a
// visitor who happens to chat with two different tradies in one browser
// shouldn't have their sessions bleed into each other.
function getSessionId(widgetKey: string): string {
  const storageKey = `workroute-widget-session-${widgetKey}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(storageKey, fresh);
  return fresh;
}

// Once a visitor has opened the chat (or explicitly dismissed the callout)
// once, they know the bubble is interactive — don't keep nagging them on
// every later page load.
function hasSeenLauncher(widgetKey: string): boolean {
  return localStorage.getItem(`workroute-widget-launcher-seen-${widgetKey}`) === "1";
}
function markLauncherSeen(widgetKey: string) {
  localStorage.setItem(`workroute-widget-launcher-seen-${widgetKey}`, "1");
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72A7.8 7.8 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
    </svg>
  );
}

// §Website Widget — the whole widget (launcher bubble + chat window) lives
// inside this iframe; the parent script (public/widget.js) only resizes the
// outer container based on the postMessage below. No direct Supabase access
// from the browser here at all — unlike Messenger, every visitor turn is a
// single synchronous request to our own API route, since there's no
// separate async actor (a tradie replying mid-conversation) to poll for.
export default function WidgetChat({
  widgetKey,
  businessName,
  defaultOpen = false,
}: {
  widgetKey: string;
  businessName: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);
  const [launcherIn, setLauncherIn] = useState(false);
  const sessionIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionIdRef.current = getSessionId(widgetKey);
  }, [widgetKey]);

  // Delayed on purpose — a callout that pops in the instant the page loads
  // reads as an ad; a beat of "the page is real, then Sarah shows up" reads
  // as a person noticing you. Skipped entirely for repeat visitors who
  // already know the bubble opens a chat.
  useEffect(() => {
    if (isOpen || hasSeenLauncher(widgetKey)) return;
    const showTimer = setTimeout(() => setShowLauncher(true), 1200);
    return () => clearTimeout(showTimer);
  }, [isOpen, widgetKey]);

  useEffect(() => {
    if (!showLauncher) return;
    const inTimer = setTimeout(() => setLauncherIn(true), 20);
    return () => clearTimeout(inTimer);
  }, [showLauncher]);

  function dismissLauncher() {
    markLauncherSeen(widgetKey);
    setLauncherIn(false);
    setShowLauncher(false);
  }

  function openFromLauncher() {
    markLauncherSeen(widgetKey);
    setIsOpen(true);
  }

  // §fix — three distinct container sizes, not just open/closed: "closed"
  // is a tight circle around just the avatar bubble (no invisible dead
  // space blocking clicks on the host page underneath — see widget.js),
  // "launcher" is the wider box only while the "Chat with {business}"
  // callout pill is actually visible, and "open" is the full chat panel.
  useEffect(() => {
    const mode = isOpen ? "open" : showLauncher ? "launcher" : "closed";
    window.parent.postMessage({ type: RESIZE_MESSAGE_TYPE, mode }, "*");
  }, [isOpen, showLauncher]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { sender: "visitor", body: text }]);

    try {
      const res = await fetch(`/api/widget/${widgetKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, message: text }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, { sender: "ai", body: data.reply }]);
      } else {
        setError(data.error ?? "Something went wrong — please try again.");
      }
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) {
    return (
      // fixed inset-0, not h-full/w-full — the root layout's <html>/<body>
      // have no explicit height set (fine for normal pages, which size to
      // content), so a percentage height here had nothing to resolve
      // against and collapsed to the button's intrinsic content size —
      // rendered in production as a small dark cap sitting at the top of
      // the container instead of filling it. Fixed positioning sizes
      // against the iframe's own viewport instead, which is always the
      // exact size public/widget.js's container div gives it.
      <div className="fixed inset-0 flex items-center justify-end gap-2">
        {showLauncher && (
          <button
            type="button"
            onClick={openFromLauncher}
            className={`flex shrink-0 items-center gap-1.5 rounded-full bg-white py-2 pl-3.5 pr-2 text-sm font-medium text-rig-900 shadow-lg transition-all duration-300 ease-out ${
              launcherIn ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
            }`}
          >
            <ChatBubbleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="whitespace-nowrap">Chat with {businessName}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                dismissLauncher();
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.stopPropagation();
                dismissLauncher();
              }}
              aria-label="Dismiss"
              className="ml-0.5 rounded-full p-1 text-rig-900/30 hover:bg-rig-900/5 hover:text-rig-900/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={openFromLauncher}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-full shadow-lg"
          aria-label={`Chat with ${businessName}`}
        >
          <SarahAvatar className="h-full w-full" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden rounded-lg bg-white shadow-lg">
      <header className="flex items-center justify-between border-b border-rig-900/10 bg-rig-900 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SarahAvatar className="h-8 w-8 shrink-0 overflow-hidden rounded-full" />
          <div>
            <p className="font-display text-sm font-semibold text-paper-50">{businessName}</p>
            <p className="text-xs text-paper-50/70">Sarah</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className="text-paper-50/70 hover:text-paper-50" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex items-end justify-start gap-2">
            <SarahAvatar className="h-6 w-6 shrink-0 overflow-hidden rounded-full" />
            <div className="max-w-[85%] rounded-lg bg-paper-50 px-3 py-2 text-sm text-rig-900 shadow-sm">
              Hi, I'm Sarah — how can I help today?
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "ai" && <SarahAvatar className="h-6 w-6 shrink-0 overflow-hidden rounded-full" />}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.sender === "visitor" ? "bg-amber-500 text-rig-950" : "bg-paper-50 text-rig-900"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-paper-50 px-3 py-2 text-sm text-rig-700/60 shadow-sm">…</div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-rust-500/10 px-3 py-2 text-sm text-rust-500 shadow-sm">{error}</div>
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
