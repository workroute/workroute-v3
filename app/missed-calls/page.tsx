import type { Metadata } from "next";
import Calculator from "./calculator";
import { WORKROUTE_DEMO_PHONE } from "@/lib/missed-call-cost";

// §missed-call report — public lead magnet, no login. A tradie plugs in their
// own numbers and sees roughly what missed calls cost them a year, then can
// have the report emailed (app/api/missed-call-report), which saves them as a
// lead for Steve. Linked from workroute.com.au and the cold-outreach texts.

export const metadata: Metadata = {
  alternates: { canonical: "/missed-calls" },
  title: "What do missed calls cost your business? | WorkRoute",
  description:
    "Free calculator for Australian tradies and local services: put in your calls, job value and how many you miss, and see roughly how much work goes to someone else each year.",
  openGraph: {
    title: "What are missed calls costing you?",
    description: "A free 1-minute calculator for tradies and local services. See how much work goes to the next number on Google.",
    url: "https://app.workroute.com.au/missed-calls",
    siteName: "WorkRoute",
    type: "website",
  },
};

export default function MissedCallsPage() {
  return (
    <main className="min-h-screen bg-paper-50">
      <header className="bg-rig-900 px-4 pb-10 pt-6 text-paper-50">
        <div className="mx-auto max-w-3xl">
          <a href="https://workroute.com.au" className="font-mono text-xs uppercase tracking-widest text-amber-500">
            WorkRoute
          </a>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl">
            What are missed calls costing you?
          </h1>
          <p className="mt-3 max-w-xl text-paper-50/75">
            When you&apos;re up a ladder, under a house or halfway through a cut, you can&apos;t get to the phone. Most new
            customers won&apos;t leave a message. They just ring the next business on Google. Put in your own numbers and see what that adds up to.
          </p>
        </div>
      </header>

      <Calculator />

      <footer className="mx-auto max-w-3xl px-4 pb-24 md:pb-12 text-sm text-rig-700/70">
        <p>
          Want to hear how WorkRoute answers? Ring Sarah on{" "}
          <a href={`tel:${WORKROUTE_DEMO_PHONE.replace(/\s/g, "")}`} className="font-medium text-steel-500 underline">
            {WORKROUTE_DEMO_PHONE}
          </a>{" "}
          and try booking in.
        </p>
        <p className="mt-2">These figures are estimates from the numbers you enter, not a guarantee.</p>
      </footer>
    </main>
  );
}
