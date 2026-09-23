import type { SupabaseClient } from "@supabase/supabase-js";

// AI Knowledge — practical, business-owner-curated examples, not
// machine-learning retraining. A tradie resolving a Needs Attention item can
// save that resolution as a reusable example of how this business actually
// handles a kind of situation; see lib/messenger-ai.ts for how these feed
// back into the AI's system prompt.

export type KnowledgeEntry = {
  id: string;
  customer_message: string;
  ai_reply: string | null;
  resolution: string;
  rating: "good" | "improved";
  created_at: string;
};

export async function saveKnowledge(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    jobId: string | null;
    customerMessage: string;
    aiReply: string | null;
    resolution: string;
    rating: "good" | "improved";
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("ai_knowledge").insert({
    business_id: params.businessId,
    job_id: params.jobId,
    customer_message: params.customerMessage,
    ai_reply: params.aiReply,
    resolution: params.resolution,
    rating: params.rating,
  });
  return { error: error?.message ?? null };
}

// Capped at a handful of the most recent examples so the system prompt
// doesn't grow unbounded as the knowledge base builds up — recency is a
// reasonable proxy for a business just starting out; topic-relevant
// retrieval is a natural upgrade once there's enough volume for recency
// alone to stop being a good filter.
const MAX_EXAMPLES = 5;

export async function getRecentKnowledge(
  supabase: SupabaseClient,
  businessId: string
): Promise<KnowledgeEntry[]> {
  const { data } = await supabase
    .from("ai_knowledge")
    .select("id, customer_message, ai_reply, resolution, rating, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(MAX_EXAMPLES);
  return data ?? [];
}
