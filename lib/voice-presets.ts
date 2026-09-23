// §voice-picker — the curated shortlist a tradie chooses from in
// Settings > Voice. Every id here was confirmed working on a real live call
// before being added (see project memory / lib/phone-ai.ts's DEFAULT_VOICE
// comment) — never add an id here that hasn't been tested that way, since a
// broken ElevenLabs voice id fails completely silently (dead air, no error)
// rather than erroring.
export type VoicePreset = {
  id: string;
  voiceId: string;
  name: string;
  gender: "female" | "male";
  description: string;
};

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "emma",
    voiceId: "56bWURjYFHyYyVf490Dp",
    name: "Emma",
    gender: "female",
    description: "Warm and clear — the current default.",
  },
  {
    id: "chloe",
    voiceId: "b8gbDO0ybjX1VA89pBdX",
    name: "Chloe",
    gender: "female",
    description: "Friendly and upbeat.",
  },
  {
    id: "jack",
    voiceId: "oUbjcKlrUrhnYf9kwdmI",
    name: "Jack",
    gender: "male",
    description: "Confident and straightforward.",
  },
  {
    id: "tom",
    voiceId: "YrAYvOVjAFiqVwBgB4qI",
    name: "Tom",
    gender: "male",
    description: "Calm, older voice.",
  },
  {
    id: "ben",
    voiceId: "hIreuBly94QFepU63yel",
    name: "Ben",
    gender: "male",
    description: "Relaxed and easygoing.",
  },
  {
    id: "rachel",
    voiceId: "paRTfYnetOrTukxfEm1J",
    name: "Rachel",
    gender: "female",
    description: "Bright and professional.",
  },
];

export function findVoicePreset(voiceId: string | null): VoicePreset | undefined {
  return VOICE_PRESETS.find((preset) => preset.voiceId === voiceId);
}
