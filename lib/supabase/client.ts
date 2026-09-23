import { createBrowserClient } from "@supabase/ssr";

// Used inside Client Components (anything with "use client" at the top).
// Reads the public URL + anon key from the browser's environment.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
