-- WorkRoute — admin tool to buy and wire up a tradie's real phone number
-- (DIDLogic purchase + fresh Vapi SIP trunk/phone-number, "create fresh,
-- never patch" per the SIP 407 fix on 2026-09-20), replacing the fully
-- manual process. Run this in the Supabase SQL Editor after 0001-0030.

alter table public.business_profiles add column if not exists didlogic_did_id text;
