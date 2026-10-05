// Welcome email — Resend. Server-only: reads RESEND_API_KEY from
// process.env directly, so this must never be imported from a "use client"
// component. See .env.local.example for setup.
import { Resend } from "resend";
import {
  calculateMissedCallCost,
  formatCount,
  formatDollars,
  WORKROUTE_MONTHLY_PRICE,
  type MissedCallInputs,
} from "./missed-call-cost";

// TODO: swap for the real unlisted YouTube link once the video is recorded.
const WELCOME_VIDEO_URL = "https://www.youtube.com/watch?v=PLACEHOLDER_UNLISTED_VIDEO_ID";

function welcomeEmailHtml(firstName: string | null): string {
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1C1F26;">
      <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #F2A900; font-weight: 600;">WorkRoute</p>
      <h1 style="font-size: 22px; margin: 8px 0 16px;">${greeting} welcome aboard.</h1>
      <p style="font-size: 15px; line-height: 1.6;">
        Your account's ready to go. Here's a quick (~3 min) video walking through the basics —
        capturing your first job, how the run sheet works, and how Messenger replies to customers for you.
      </p>
      <p style="margin: 24px 0;">
        <a href="${WELCOME_VIDEO_URL}" style="background:#F2A900; color:#14171C; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600; display:inline-block;">
          Watch the quick start video
        </a>
      </p>
      <p style="font-size: 15px; line-height: 1.6;">
        Any questions, just reply to this email.
      </p>
    </div>
  `;
}

function completionEmailHtml(
  customerName: string,
  businessName: string,
  summary: string,
  total: number,
  googleReviewLink: string | null,
  invoiceNumber: number | null,
  bankDetails: string | null,
  paymentLink: string | null
): string {
  const reviewBlock = googleReviewLink
    ? `<p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
         If you were happy with the job, a quick
         <a href="${googleReviewLink}" style="color:#F2A900;">Google review</a> helps us out.
       </p>`
    : "";

  // §instant-payment-link — shown ahead of bank details since it's the
  // faster option when the tradie's set one (Profile > Instant payment
  // link) — plain text/URL as typed, WorkRoute never processes it itself.
  const paymentLinkBlock = paymentLink
    ? `<p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
         <strong>Pay instantly:</strong> <a href="${paymentLink}" style="color:#F2A900;">${paymentLink}</a>
       </p>`
    : "";

  const bankBlock = bankDetails
    ? `<p style="font-size: 14px; line-height: 1.6; margin-top: 16px; white-space: pre-line;">
         <strong>Payment details:</strong><br>${bankDetails}
       </p>`
    : "";

  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1C1F26;">
      ${invoiceNumber !== null ? `<p style="font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: #617086;">Invoice #${invoiceNumber}</p>` : ""}
      <h1 style="font-size: 20px; margin: 0 0 16px;">Hi ${customerName}, your job is complete.</h1>
      <p style="font-size: 15px; line-height: 1.6;">${summary}</p>
      <p style="font-size: 18px; font-weight: 600; margin: 20px 0;">Total: $${total.toFixed(2)}</p>
      <p style="font-size: 14px; line-height: 1.6; color: #3A4149;">Thanks for choosing ${businessName}.</p>
      ${paymentLinkBlock}
      ${bankBlock}
      ${reviewBlock}
    </div>
  `;
}

export async function sendCompletionEmail(
  to: string,
  customerName: string,
  businessName: string,
  summary: string,
  total: number,
  googleReviewLink: string | null = null,
  invoiceNumber: number | null = null,
  bankDetails: string | null = null,
  paymentLink: string | null = null
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — missing RESEND_API_KEY." };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to,
      subject: `${businessName}: your job is complete${invoiceNumber !== null ? ` (Invoice #${invoiceNumber})` : ""}`,
      html: completionEmailHtml(customerName, businessName, summary, total, googleReviewLink, invoiceNumber, bankDetails, paymentLink),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

function onboardingReminderEmailHtml(firstName: string | null): string {
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1C1F26;">
      <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #F2A900; font-weight: 600;">WorkRoute</p>
      <h1 style="font-size: 22px; margin: 8px 0 16px;">${greeting} Sarah's ready — just needs your pricing.</h1>
      <p style="font-size: 15px; line-height: 1.6;">
        You got Sarah set up a couple of days ago, but she still can't quote a real price on a call yet — that's
        the one thing left. Takes about 10 minutes to fill in for your trade.
      </p>
      <p style="margin: 24px 0;">
        <a href="https://app.workroute.com.au/app/pricing" style="background:#F2A900; color:#14171C; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600; display:inline-block;">
          Set up your pricing
        </a>
      </p>
      <p style="font-size: 15px; line-height: 1.6;">
        Any questions, just reply to this email.
      </p>
    </div>
  `;
}

export async function sendOnboardingReminderEmail(
  to: string,
  firstName: string | null
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Onboarding reminder isn't configured yet — missing RESEND_API_KEY." };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to,
      subject: "Sarah's ready — just needs your pricing",
      html: onboardingReminderEmailHtml(firstName),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

export async function sendWelcomeEmail(
  to: string,
  firstName: string | null
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Welcome email isn't configured yet — missing RESEND_API_KEY." };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to,
      subject: "Welcome to WorkRoute",
      html: welcomeEmailHtml(firstName),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

// §WorkRoute sales chat — the full details of a visitor who asked, in the
// chat on workroute.com.au, for the owner to follow up
// (lib/workroute-sales-ai.ts). Visitor-typed text, so everything is escaped.
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendSalesLeadEmail(
  prospect: { name?: string; phone?: string; email?: string; business?: string; notes?: string },
  transcript: { sender: "visitor" | "ai"; body: string }[],
  source: "website chat" | "phone line" | "missed-call report" = "website chat"
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — missing RESEND_API_KEY." };
  }

  const rows = (
    [
      ["Name", prospect.name],
      ["Phone", prospect.phone],
      ["Email", prospect.email],
      ["Business", prospect.business],
      ["Wants", prospect.notes],
    ] as const
  )
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `<p style="margin: 4px 0;"><strong>${label}:</strong> ${escapeHtml(value!.trim())}</p>`)
    .join("");

  const chat = transcript
    .map(
      (m) =>
        `<p style="margin: 6px 0;"><strong>${m.sender === "visitor" ? "Visitor" : "Sarah"}:</strong> ${escapeHtml(m.body)}</p>`
    )
    .join("");

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to: process.env.SALES_LEAD_EMAIL || "steve@workroute.com.au",
      replyTo: prospect.email?.trim() || undefined,
      subject: `New WorkRoute lead: ${prospect.name?.trim() || (source === "phone line" ? "phone caller" : source === "missed-call report" ? "missed-call report" : "website visitor")}`,
      html: `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1C1F26;">
          <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #F2A900; font-weight: 600;">WorkRoute ${source}</p>
          <h1 style="font-size: 20px; margin: 8px 0 16px;">Someone wants to hear from you</h1>
          ${rows}
          ${chat ? `<h2 style="font-size: 15px; margin: 24px 0 8px;">The chat so far</h2>
          <div style="font-size: 14px; line-height: 1.5; color: #3A4149;">${chat}</div>` : ""}
        </div>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

// §WorkRoute sales chat — sent to a workroute.com.au visitor who asked Sarah
// for the free-trial link. Replies go to the owner, not the no-reply sender.
export async function sendTrialLinkEmail(
  to: string,
  name: string | null,
  signupUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — missing RESEND_API_KEY." };
  }

  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to,
      replyTo: process.env.SALES_LEAD_EMAIL || "steve@workroute.com.au",
      subject: "Your WorkRoute free trial link",
      html: `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1C1F26;">
          <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #F2A900; font-weight: 600;">WorkRoute</p>
          <h1 style="font-size: 22px; margin: 8px 0 16px;">${greeting} here's your free trial link.</h1>
          <p style="font-size: 15px; line-height: 1.6;">
            Thanks for chatting with Sarah. Your free trial runs for 14 days or 150 calls, whichever comes first.
            Sign up below, fill in your business details and pricing, and Sarah can start answering your calls.
          </p>
          <p style="margin: 24px 0;">
            <a href="${signupUrl}" style="background:#F2A900; color:#14171C; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600; display:inline-block;">
              Start my free trial
            </a>
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            Any questions, just reply to this email. It comes straight to me.<br>
            Steve, WorkRoute founder
          </p>
        </div>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

// §missed-call report — sent to a tradie who used the /missed-calls
// calculator and asked for their report. Figures are recalculated from the
// (already clamped) inputs here, never taken from the browser. Replies go to
// the owner.
export async function sendMissedCallReportEmail(
  to: string,
  name: string | null,
  inputs: MissedCallInputs,
  demoPhone: string,
  signupUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — missing RESEND_API_KEY." };
  }

  const r = calculateMissedCallCost(inputs);
  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  const row = (label: string, value: string) =>
    `<tr><td style="padding: 6px 0; color: #3A4149;">${label}</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${value}</td></tr>`;
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "WorkRoute <onboarding@resend.dev>",
      to,
      replyTo: process.env.SALES_LEAD_EMAIL || "steve@workroute.com.au",
      subject: `Your missed-call report: about ${formatDollars(r.lostPerYear)} a year`,
      html: `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1C1F26;">
          <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #F2A900; font-weight: 600;">WorkRoute missed-call report</p>
          <h1 style="font-size: 22px; margin: 8px 0 8px;">${greeting} missed calls could be costing you about ${formatDollars(r.lostPerYear)} a year.</h1>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">That's roughly ${formatDollars(r.lostPerMonth)} a month, based on the numbers you entered.</p>

          <h2 style="font-size: 15px; margin: 24px 0 4px;">Your numbers</h2>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            ${row("Calls a week", formatCount(inputs.callsPerWeek))}
            ${row("Calls you miss", `${inputs.missedPct}%`)}
            ${row("Missed calls that are new work", `${inputs.newWorkPct}%`)}
            ${row("New callers who ring someone else", `${inputs.noCallbackPct}%`)}
            ${row("Enquiries you usually win", `${inputs.winPct}%`)}
            ${row("Average job", formatDollars(inputs.jobValue))}
            ${row("Times a customer books you a year", formatCount(inputs.jobsPerYear))}
          </table>

          <h2 style="font-size: 15px; margin: 24px 0 4px;">What that adds up to</h2>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            ${row("Missed calls a week", formatCount(r.missedPerWeek))}
            ${row("New customers lost a week", formatCount(r.lostJobsPerWeek))}
            ${row("New customers lost a year", formatCount(r.lostCustomersPerYear))}
            ${row("Lost a month", formatDollars(r.lostPerMonth))}
            ${row("Lost a year", formatDollars(r.lostPerYear))}
          </table>

          <p style="font-size: 15px; line-height: 1.6; margin: 24px 0 0;">
            WorkRoute's AI receptionist, Sarah, answers the calls you can't get to and books it straight into your WorkRoute diary.
            It's $${WORKROUTE_MONTHLY_PRICE} a month${r.jobsToCoverPrice > 0 ? `, so it pays for itself if it saves you ${r.jobsToCoverPrice} job${r.jobsToCoverPrice === 1 ? "" : "s"} a month` : ""}.
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            Want to hear her first? Ring <a href="tel:${demoPhone.replace(/\s/g, "")}" style="color: #3B5166; font-weight: 600;">${demoPhone}</a> and try booking in.
          </p>
          <p style="margin: 24px 0;">
            <a href="${signupUrl}" style="background:#F2A900; color:#14171C; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600; display:inline-block;">
              Start my free trial
            </a>
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            Any questions, just reply to this email. It comes straight to me.<br>
            Steve, WorkRoute founder
          </p>
          <p style="font-size: 12px; line-height: 1.5; color: #3A4149; opacity: 0.7; margin-top: 24px;">
            This is an estimate from the numbers you entered, not a guarantee.
          </p>
        </div>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}
