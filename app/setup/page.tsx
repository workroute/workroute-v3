import type { Metadata } from "next";
import QuestionnaireForm from "./questionnaire-form";

// §setup-questionnaire — public, no login. A tradie Steve has spoken to answers
// the questions Sarah needs on their phone, and Steve enters the answers into
// their Settings for them (app/api/setup-questionnaire). Not listed in the
// sitemap and kept out of search results: it is a link to hand to someone, not
// a page to find.

export const metadata: Metadata = {
  title: "Set up your receptionist | WorkRoute",
  description: "A few quick questions so Steve can set Sarah up for your business.",
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return (
    <main className="min-h-screen bg-paper-50">
      <header className="bg-rig-900 px-4 pb-10 pt-6 text-paper-50">
        <div className="mx-auto max-w-2xl">
          <a href="https://workroute.com.au" className="font-mono text-xs uppercase tracking-widest text-amber-500">
            WorkRoute
          </a>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl">
            Let&apos;s get Sarah answering your calls
          </h1>
          <p className="mt-3 max-w-xl text-paper-50/75">
            Answer these questions in your own words. About five minutes. Steve will set everything up for you, then
            ring you so you can hear her answer as your business. Rough answers are fine.
          </p>
        </div>
      </header>

      <QuestionnaireForm />
    </main>
  );
}
