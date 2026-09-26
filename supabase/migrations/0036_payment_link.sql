-- §instant-payment-link — free text so it fits whatever the tradie already
-- uses to get paid instantly (a PayID, a Stripe/Square/PayPal.me link, an
-- Osko QR, anything) — WorkRoute never touches the money itself, same
-- principle as the existing bank_details field, just shown to the customer
-- alongside it on the completion message/invoice.

alter table public.business_profiles add column if not exists payment_link text;
