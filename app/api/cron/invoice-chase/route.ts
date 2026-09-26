import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getInvoicesDueForReminder,
  getInvoicesDueForCall,
  markReminderSent,
  markReminderCallDone,
  placeOutboundInvoiceChaseCall,
} from "@/lib/invoice-chase";
import { sendSms } from "@/lib/mobile-message";
import { messageFor } from "@/lib/notifications";

// §Invoice chase — runs once a day. Week 1: text a reminder (reusing the
// same Messenger-link pattern as every other customer SMS in this app).
// Week 2: if still unpaid and the reminder didn't resolve it, escalate to a
// short outbound call (lib/phone-ai.ts's buildPaymentChaseAssistantConfig).
// Both steps are skipped for any business with no connected Vapi number for
// the call step specifically — the SMS step doesn't need one.
const REMINDER_DAYS_AFTER_SENT = 7;
const CALL_DAYS_AFTER_REMINDER = 7;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const appOrigin = new URL(request.url).origin;

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, business_name, trade, first_name, service_area, bank_details, payment_link, vapi_phone_number_id, ai_voice_id, ai_persona_name, pronunciation_overrides");

  let remindersSent = 0;
  let callsPlaced = 0;

  for (const business of businesses ?? []) {
    const reminderCandidates = await getInvoicesDueForReminder(supabase, business.user_id, REMINDER_DAYS_AFTER_SENT);

    for (const invoice of reminderCandidates) {
      const messengerLink = `${appOrigin}/m/${invoice.customerAccessToken}`;
      const message = messageFor(
        "invoice_reminder",
        invoice.customerName,
        business.first_name,
        business.business_name,
        messengerLink,
        null,
        null,
        { number: invoice.invoiceNumber, amount: invoice.amount, bankDetails: business.bank_details, paymentLink: business.payment_link }
      );

      const result = await sendSms(invoice.customerPhone, message);
      if (result.ok) {
        await markReminderSent(supabase, invoice.jobId);
        remindersSent++;
      }
    }

    if (!business.vapi_phone_number_id) continue; // no connected number — can't place the escalation call

    const callCandidates = await getInvoicesDueForCall(supabase, business.user_id, CALL_DAYS_AFTER_REMINDER);

    for (const invoice of callCandidates) {
      const result = await placeOutboundInvoiceChaseCall(
        supabase,
        {
          businessId: business.user_id,
          businessName: business.business_name,
          trade: business.trade,
          firstName: business.first_name,
          serviceArea: business.service_area,
          voiceId: business.ai_voice_id,
          personaName: business.ai_persona_name,
          startingPrice: null,
          pronunciationOverrides: business.pronunciation_overrides ?? [],
          vapiPhoneNumberId: business.vapi_phone_number_id,
        },
        {
          jobId: invoice.jobId,
          phone: invoice.customerPhone,
          name: invoice.customerName,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          bankDetails: business.bank_details,
        }
      );

      if (result.ok) {
        await markReminderCallDone(supabase, invoice.jobId);
        callsPlaced++;
      }
    }
  }

  return NextResponse.json({ ok: true, remindersSent, callsPlaced });
}
