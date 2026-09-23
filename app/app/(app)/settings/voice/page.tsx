import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VoiceForm from "./voice-form";

// §voice-picker — lets a tradie choose which of the pre-tested ElevenLabs
// voices their AI uses, and what name it introduces itself as. Both columns
// are nullable on business_profiles — leaving this page untouched keeps the
// system default (see lib/phone-ai.ts's resolveVoice/resolvePersonaName).
export default async function VoiceSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("ai_voice_id, ai_persona_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-paper-50 pb-16 md:pb-0">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href="/app/settings" className="text-sm font-medium text-steel-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-rig-900">Voice</h1>
        <p className="mt-1 text-sm text-rig-700">
          Choose the voice your AI uses on calls, and what it calls itself. It'll still always say it's an AI —
          this just changes how it sounds.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <VoiceForm
            userId={user.id}
            initialVoiceId={profile?.ai_voice_id ?? null}
            initialPersonaName={profile?.ai_persona_name ?? null}
          />
        </div>
      </div>
    </main>
  );
}
