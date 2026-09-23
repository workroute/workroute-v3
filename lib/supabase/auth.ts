import { cache } from "react";
import { createClient } from "./server";

// §27 — the (app) layout and every page under it each need the current
// user/profile. cache() dedupes identical calls within a single request,
// so the layout's call and a page's own call become one real network
// round trip each, not two — without this, centralizing the auth check in
// the layout would just relocate the per-page cost, not remove it.
export const getAuthedUser = cache(async () => {
  const supabase = createClient();
  return supabase.auth.getUser();
});

export const getBusinessProfile = cache(async (userId: string) => {
  const supabase = createClient();
  return supabase.from("business_profiles").select("*").eq("user_id", userId).maybeSingle();
});
