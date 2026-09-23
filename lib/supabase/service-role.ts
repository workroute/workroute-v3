import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// §Messenger — bypasses RLS entirely. Server-only, and only ever imported
// from a trusted route handler (never a "use client" file, never anything
// reachable from the browser). Used for exactly two things: inserting an
// AI-authored message, and the AI's schedule tool-calls — both always with
// job_id/business_id already resolved via a token-validated RPC, never from
// anything a request supplies directly. See lib/messenger-ai.ts and
// lib/messenger-scheduling.ts.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
