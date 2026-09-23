-- Voice picker — see lib/voice-presets.ts and lib/phone-ai.ts's
-- resolveVoice/resolvePersonaName. Nullable by design: a business that
-- hasn't visited Settings > Voice yet gets the system default (currently
-- "Emma") unchanged, exactly as before this feature existed.
alter table public.business_profiles add column if not exists ai_voice_id text;
alter table public.business_profiles add column if not exists ai_persona_name text;
