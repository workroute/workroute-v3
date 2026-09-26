// §13 — customer SMS templates. Plain interpolation, no AI. SMS is now a
// one-way invitation only (§Messenger) — every event links into WorkRoute
// Messenger, where the actual two-way conversation happens; the SMS itself
// never expects or handles a reply.
//
// §23: WorkRoute must never appear in anything a customer sees — only the
// tradie's own business identity. Applies to every customer-facing surface
// going forward (SMS, Messenger, phone assistant, whatever comes next).

export type NotificationEvent =
  | "booking_confirmed"
  | "on_the_way"
  | "running_late"
  | "completed"
  | "recurring_renewal"
  | "invoice_reminder"
  | "quote_given";

// Falls back to the business name alone if the tradie hasn't set a first
// name yet — never broken grammar, and still never mentions WorkRoute.
function tradieLabel(firstName: string | null, businessName: string): string {
  return firstName ? `${firstName} from ${businessName}` : businessName;
}

// Shared by every place a job's first booking gets confirmed (the Run
// Sheet's own Schedule modal, and the phone AI's book_appointment tool) —
// one formatting rule so "Wed 23 Sep, 9:00 AM" reads the same everywhere.
export function formatAppointmentLabel(
  date: string,
  time: string | null,
  block: "Morning" | "Afternoon" | "Evening" | null
): string {
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = time
    ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    : block;
  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel;
}

export function messageFor(
  event: NotificationEvent,
  customerName: string,
  firstName: string | null,
  businessName: string,
  messengerLink: string,
  etaMinutes: number | null = null,
  renewalDateLabel: string | null = null,
  invoiceDetail: { number: number; amount: number; bankDetails: string | null; paymentLink?: string | null } | null = null,
  appointmentLabel: string | null = null,
  quoteDetail: { amount: number; jobLabel: string | null } | null = null
): string {
  const invite = ` View details and message us here: ${messengerLink}`;

  switch (event) {
    case "booking_confirmed":
      return `${businessName}: Your appointment is confirmed${
        appointmentLabel ? ` for ${appointmentLabel}` : ""
      }.${invite}`;
    case "on_the_way":
      return etaMinutes !== null
        ? `Hi ${customerName}, ${tradieLabel(firstName, businessName)} is on his way — estimated ${etaMinutes} minute${etaMinutes === 1 ? "" : "s"} away.${invite}`
        : `Hi ${customerName}, ${tradieLabel(firstName, businessName)} is on his way to you now. See you shortly.${invite}`;
    case "running_late":
      return `Hi ${customerName}, we're sorry but we're running a little behind schedule. Thanks for your patience.${invite}`;
    case "completed":
      // Dropped the old "just reply to this message" line — SMS is one-way
      // now, a reply here would go nowhere. The link above is the real
      // "message us" instruction.
      return `Thanks for choosing us today, ${customerName}. Your job has now been completed.${invite}`;
    case "recurring_renewal":
      return `Hi ${customerName}, your regular service with ${businessName} is booked through to ${renewalDateLabel ?? "your next visit"}. Want your next 5 visits booked in too?${invite}`;
    case "invoice_reminder": {
      const paymentLinkLine = invoiceDetail?.paymentLink ? `\n\nPay instantly: ${invoiceDetail.paymentLink}` : "";
      const bankLine = invoiceDetail?.bankDetails ? `\n\nPayment details:\n${invoiceDetail.bankDetails}` : "";
      return `Hi ${customerName}, just a friendly reminder that invoice #${invoiceDetail?.number ?? ""} for $${invoiceDetail?.amount.toFixed(2) ?? ""} from ${businessName} is still outstanding.${paymentLinkLine}${bankLine}${invite}`;
    }
    case "quote_given":
      return `Hi ${customerName}, here's your quote from ${tradieLabel(firstName, businessName)}: $${quoteDetail?.amount.toFixed(2) ?? ""}${
        quoteDetail?.jobLabel ? ` for ${quoteDetail.jobLabel}` : ""
      }. We'll be in touch shortly to see if you'd like to go ahead.${invite}`;
  }
}
