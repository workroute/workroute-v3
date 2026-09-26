// Welcome email — Resend. Server-only: reads RESEND_API_KEY from
// process.env directly, so this must never be imported from a "use client"
// component. See .env.local.example for setup.
import { Resend } from "resend";

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
  bankDetails: string | null
): string {
  const reviewBlock = googleReviewLink
    ? `<p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
         If you were happy with the job, a quick
         <a href="${googleReviewLink}" style="color:#F2A900;">Google review</a> helps us out.
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
  bankDetails: string | null = null
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
      html: completionEmailHtml(customerName, businessName, summary, total, googleReviewLink, invoiceNumber, bankDetails),
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
