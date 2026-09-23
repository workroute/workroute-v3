"use client";

import { useState, type ReactNode } from "react";

const TABS = ["Details", "Customer", "Notes", "History"] as const;
type Tab = (typeof TABS)[number];

// §32e — reorganizes the existing job detail content into tabs; each tab's
// content is passed in already-rendered from the server component (no new
// data fetching happens here, just client-side tab-switching state).
export default function JobTabs({
  details,
  customer,
  notes,
  history,
}: {
  details: ReactNode;
  customer: ReactNode;
  notes: ReactNode;
  history: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("Details");
  const content: Record<Tab, ReactNode> = { Details: details, Customer: customer, Notes: notes, History: history };

  return (
    <div className="mt-6">
      <div className="flex gap-1 rounded-lg bg-paper-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              active === tab ? "bg-white text-rig-900 shadow-sm" : "text-rig-700 hover:text-rig-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-4">{content[active]}</div>
    </div>
  );
}
