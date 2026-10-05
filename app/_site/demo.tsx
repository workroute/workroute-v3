"use client";

import { useState } from "react";
import { Icon } from "./ui";

import { HOMEPAGE_SCENARIOS, type Scenario } from "./scenarios";

// An illustrative call (see scenarios.ts). With one scenario the tabs are hidden.
export default function Demo({ scenarios = HOMEPAGE_SCENARIOS }: { scenarios?: Scenario[] }) {
  const [active, setActive] = useState(scenarios[0].id);
  const scenario = scenarios.find((s) => s.id === active) ?? scenarios[0];

  return (
    <div className="mx-auto w-full max-w-md">
      {scenarios.length > 1 && (
      <div role="tablist" aria-label="Example conversations" className="mb-3 flex flex-wrap justify-center gap-2 lg:justify-start">
        {scenarios.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === active}
            onClick={() => setActive(s.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              s.id === active
                ? "border-brand-sky bg-brand-sky text-brand-deep"
                : "border-white/20 text-white/80 hover:border-white/50 hover:text-white"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3 bg-brand-deep px-4 py-3">
          <img src="/sarah-avatar.png" alt="" className="h-10 w-10 rounded-full object-cover object-top ring-2 ring-brand-sky/60" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-white">Sarah · {scenario.business}</p>
            <p className="flex items-center gap-1.5 text-xs text-white/65">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Answering now
            </p>
          </div>
          <Icon name="phone" className="h-5 w-5 text-brand-sky" />
        </div>

        <div className="space-y-3 bg-brand-ice/60 px-4 py-4" aria-live="polite">
          {scenario.lines.map((line, i) => (
            <div key={`${scenario.id}-${i}`} className={`flex ${line.who === "caller" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
                  line.who === "caller"
                    ? "rounded-br-md bg-brand-navy text-white"
                    : "rounded-bl-md border border-brand-navy/10 bg-white text-brand-ink"
                }`}
              >
                {line.text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 border-t border-brand-navy/10 bg-white px-4 py-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Booked into your diary</p>
            <p className="font-display text-sm font-semibold text-brand-ink">
              {scenario.booked.when} · {scenario.booked.what}
            </p>
            <p className="text-xs text-brand-ink/60">{scenario.booked.extra}</p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/55 lg:text-left">An example conversation. Prices are estimates from the prices you enter.</p>
    </div>
  );
}
