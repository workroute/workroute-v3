"use client";

import { useState } from "react";

// Must match WIDGET_ORIGIN in public/widget.js exactly.
const WIDGET_ORIGIN = "https://workroute-v3.vercel.app";
// The real customer-facing domain — this link gets shared directly (a
// business card, a social bio, a text), unlike the embed snippet above, so
// it should read as the tradie's own app, not the raw Vercel URL.
const APP_ORIGIN = "https://app.workroute.com.au";

export default function WebsiteChatForm({ widgetKey }: { widgetKey: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [bookingCopyStatus, setBookingCopyStatus] = useState<"idle" | "copied">("idle");
  const [replyCopyStatus, setReplyCopyStatus] = useState<"idle" | "copied">("idle");

  const snippet = `<script async src="${WIDGET_ORIGIN}/widget.js" data-widget-key="${widgetKey}"></script>`;
  const bookingLink = `${APP_ORIGIN}/book/${widgetKey}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

  // For the tradie's own Facebook/Instagram auto-reply. Pasted into Meta's own
  // settings, so nothing here connects to Meta — it's just text plus the link.
  const socialReply = `Thanks for getting in touch! The quickest way to get booked in is here: ${bookingLink} — pick a time that suits and it's locked in straight away. Or leave your details with us and we'll get back to you as soon as we can.`;

  async function handleCopyReply() {
    await navigator.clipboard.writeText(socialReply);
    setReplyCopyStatus("copied");
    setTimeout(() => setReplyCopyStatus("idle"), 2000);
  }

  async function handleCopyBookingLink() {
    await navigator.clipboard.writeText(bookingLink);
    setBookingCopyStatus("copied");
    setTimeout(() => setBookingCopyStatus("idle"), 2000);
  }

  if (!widgetKey) {
    return (
      <p className="text-sm text-rig-700">
        Couldn't load your widget key — refresh this page, or contact support if this keeps happening.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display font-semibold text-rig-900">Your embed snippet</p>
        <p className="mt-1 text-xs text-rig-700/70">
          Paste this once into your website's HTML (most site builders have a spot for "custom code" or "header
          scripts") — that's the whole setup, nothing else to configure.
        </p>
        <pre className="mt-3 overflow-x-auto rounded border border-rig-700/20 bg-paper-50 p-3 text-xs text-rig-900">
          <code>{snippet}</code>
        </pre>
        <button type="button" onClick={handleCopy} className="btn-primary mt-3">
          {copyStatus === "copied" ? "Copied!" : "Copy snippet"}
        </button>
      </div>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">Your booking page</p>
        <p className="mt-1 text-xs text-rig-700/70">
          A direct link customers can use to book themselves in — no call or chat needed. This one's just a plain
          web address, not code, so it goes wherever you'd normally share a link, not inside your website's code
          like the snippet above.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded border border-rig-700/20 bg-paper-50 p-3">
          <code className="min-w-0 flex-1 truncate text-xs text-rig-900">{bookingLink}</code>
          <button type="button" onClick={handleCopyBookingLink} className="btn-secondary shrink-0 whitespace-nowrap text-xs">
            {bookingCopyStatus === "copied" ? "Copied!" : "Copy link"}
          </button>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-rig-700/70">
          <li>
            <b className="text-rig-900">Google Business Profile</b> — there's usually a "booking link" or "website"
            field, perfect spot for it.
          </li>
          <li>
            <b className="text-rig-900">Instagram or Facebook bio link.</b>
          </li>
          <li>
            <b className="text-rig-900">A "Book Now" button on your own website</b> — if you use a site builder
            (Wix, Squarespace, etc.), just add a normal button or link pointing at this address, not code.
          </li>
          <li>
            <b className="text-rig-900">Business cards or a QR code</b> — since it's just a link, it can be turned
            into a QR code too.
          </li>
          <li>
            <b className="text-rig-900">A text message or reply to an enquiry</b> — e.g. "Here's a link to book
            yourself in: {bookingLink}"
          </li>
        </ul>
      </div>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">Answer Facebook and Instagram messages</p>
        <p className="mt-1 text-xs text-rig-700/70">
          When someone messages your Facebook page or Instagram, you can have it reply instantly with your booking
          link, so they can book themselves in even when you&apos;re on a job. You set this up once, inside Facebook
          or Instagram, using their own automatic reply setting. Here&apos;s a reply ready to paste:
        </p>
        <p className="mt-3 rounded border border-rig-700/20 bg-paper-50 p-3 text-xs text-rig-900">{socialReply}</p>
        <button type="button" onClick={handleCopyReply} className="btn-secondary mt-3 text-xs">
          {replyCopyStatus === "copied" ? "Copied!" : "Copy this reply"}
        </button>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-rig-700/70">
          <li>
            <b className="text-rig-900">Facebook:</b> open your business page&apos;s inbox (in the Facebook or Meta
            Business Suite app), find <b className="text-rig-900">Automated responses</b> or{" "}
            <b className="text-rig-900">Instant reply</b>, turn it on, and paste the reply above.
          </li>
          <li>
            <b className="text-rig-900">Instagram:</b> in your Instagram messages settings, look for{" "}
            <b className="text-rig-900">Saved replies</b> or <b className="text-rig-900">Automated responses</b>{" "}
            and add it there.
          </li>
          <li>
            Facebook and Instagram move these menus around from time to time. If you can&apos;t find the setting,
            search for &ldquo;instant reply&rdquo; or &ldquo;automated responses&rdquo; in your page or app
            settings.
          </li>
        </ol>
      </div>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">Try it now</p>
        <p className="mt-1 text-xs text-rig-700/70">
          This is exactly what your website visitors will see — chat with your own Sarah below before adding the
          snippet to your site.
        </p>
        <div className="relative mt-3 h-[500px] w-full overflow-hidden rounded-lg border border-rig-700/20">
          <iframe
            src={`/widget-frame?key=${widgetKey}&preview=1`}
            title="Widget preview"
            className="h-full w-full border-none"
          />
        </div>
      </div>
    </div>
  );
}
