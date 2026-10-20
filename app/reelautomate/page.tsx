import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReelAutomate | Turn your clips and voice recordings into finished videos",
  description:
    "ReelAutomate joins your video clips and voice recordings into finished videos, with an intro, outro and title, ready to download for Reels and YouTube. A$39 per month, cancel any time.",
  alternates: { canonical: "https://reelautomate.com" },
  // Not listed in search results until the product is ready to launch
  robots: { index: false, follow: false },
};

const CONTACT_EMAIL = "support@workroute.com.au";

const STEPS = [
  {
    title: "Add your clips and voice recordings",
    body: "Upload your screen recordings or phone footage, with a voice recording for each scene.",
  },
  {
    title: "Make your first version",
    body: "ReelAutomate joins each clip to its voice recording, adds your intro, outro and title, and gives you a finished video.",
  },
  {
    title: "Change anything in plain English",
    body: "Type what you want changed, such as a shorter video, a title, or a louder voiceover, and it updates the video. Undo any change with one click.",
  },
];

const FEATURES = [
  "Each voice recording plays over its own clip",
  "Intro and outro from a picture or a short video",
  "Title text over the start of your video",
  "Vertical (Reels) and horizontal (YouTube) versions",
  "Background music under your voiceover",
  "Download your finished videos any time",
];

export default function ReelAutomatePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/reelautomate-logo.png" alt="ReelAutomate" className="h-12 w-auto" />
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=ReelAutomate`}
            className="rounded-lg bg-[#0a6fd6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#095bb0]"
          >
            Get started
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h1 className="text-4xl font-bold leading-tight text-[#0b1f4d] sm:text-5xl">
            Turn your clips and voice recordings into finished videos
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            ReelAutomate puts your video clips and voice recordings together for you, adds an intro, outro and
            title, and gives you a video ready to post on Reels and YouTube. No editing software to learn.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=ReelAutomate`}
            className="mt-7 inline-block rounded-lg bg-[#0a6fd6] px-6 py-3 font-semibold text-white hover:bg-[#095bb0]"
          >
            Get started
          </a>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-[#0b1f4d]">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-slate-200 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a6fd6] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-[#0b1f4d]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-[#0b1f4d]">What you get</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-slate-700">
                <span className="mt-1 text-[#0a6fd6]" aria-hidden="true">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-[#0b1f4d]">Pricing</h2>
          <p className="mt-3 text-4xl font-bold text-[#0b1f4d]">
            A$39 <span className="text-lg font-medium text-slate-500">per month</span>
          </p>
          <p className="mt-2 text-slate-600">One simple monthly price. Cancel any time.</p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=ReelAutomate`}
            className="mt-5 inline-block rounded-lg bg-[#0a6fd6] px-6 py-3 font-semibold text-white hover:bg-[#095bb0]"
          >
            Get started
          </a>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-[#0b1f4d]">Cancellation and refunds</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
            You can cancel your subscription at any time and you will keep access until the end of the month you
            have paid for. If something is not right, email us within 7 days of a payment and we will work it out
            with you.
          </p>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-[#0b1f4d]">Contact</h2>
          <p className="mt-3 text-slate-600">
            Questions about ReelAutomate? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0a6fd6] underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} ReelAutomate. Australia.
        </div>
      </footer>
    </div>
  );
}
