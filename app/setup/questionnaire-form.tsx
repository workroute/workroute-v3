"use client";

import { useState } from "react";
import { TRADE_NAMES } from "@/lib/trade-questions";
import { EMERGENCY_CHOICES, SETUP_FIELDS, type SetupAnswers } from "@/lib/setup-questionnaire";
import { WORKROUTE_DEMO_PHONE, WORKROUTE_SIGNUP_URL } from "@/lib/missed-call-cost";

const EMPTY_ANSWERS = Object.fromEntries(SETUP_FIELDS.map((f) => [f.key, ""])) as SetupAnswers;

export default function QuestionnaireForm() {
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function setField(key: keyof SetupAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/setup-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, website }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatus("idle");
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("sent");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("idle");
      setError("Couldn't reach WorkRoute. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-rig-900">Thanks, you&apos;re done.</h2>
          <p className="mt-2 text-sm text-rig-700">
            Steve has your answers. One more step: create your free account so he can set it up under your own login.
            It takes about a minute and there&apos;s no card needed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={WORKROUTE_SIGNUP_URL} className="btn-primary">
              Create my free account
            </a>
            <a href={`tel:${WORKROUTE_DEMO_PHONE.replace(/\s/g, "")}`} className="btn-secondary">
              Hear Sarah: {WORKROUTE_DEMO_PHONE}
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-12">
      <div className="space-y-5 rounded-lg bg-white p-5 shadow-sm">
        {SETUP_FIELDS.map((field, i) => {
          const id = `setup-${field.key}`;
          const value = answers[field.key];
          return (
            <div key={field.key}>
              <label htmlFor={id} className="field-label">
                {i + 1}. {field.label}
              </label>
              {field.hint && <p className="mb-1 text-sm text-rig-700">{field.hint}</p>}

              {field.kind === "trade" ? (
                <select
                  id={id}
                  required={field.required}
                  value={value}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="field-input"
                >
                  <option value="" disabled>
                    Choose your trade
                  </option>
                  {TRADE_NAMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              ) : field.kind === "emergency" ? (
                <select
                  id={id}
                  value={value}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="field-input"
                >
                  <option value="">Choose one</option>
                  {EMERGENCY_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : field.kind === "textarea" ? (
                <textarea
                  id={id}
                  rows={3}
                  maxLength={field.maxLength}
                  value={value}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="field-input"
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  id={id}
                  type={field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : "text"}
                  required={field.required}
                  maxLength={field.maxLength}
                  autoComplete={
                    field.key === "name"
                      ? "given-name"
                      : field.key === "business"
                        ? "organization"
                        : field.key === "mobile"
                          ? "tel"
                          : field.key === "email"
                            ? "email"
                            : undefined
                  }
                  value={value}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="field-input"
                  placeholder={field.placeholder}
                />
              )}
            </div>
          );
        })}

        {/* Honeypot: hidden from people, filled in by bots. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send my answers"}
          </button>
          <p className="text-sm text-rig-700">No card needed. Free for 14 days, no lock-in.</p>
        </div>
      </div>
    </form>
  );
}
