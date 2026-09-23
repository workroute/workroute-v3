"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { VOICE_PRESETS, findVoicePreset } from "@/lib/voice-presets";

const DEFAULT_PRESET = VOICE_PRESETS[0]; // Emma — matches lib/phone-ai.ts's DEFAULT_VOICE/DEFAULT_PERSONA_NAME

export default function VoiceForm({
  userId,
  initialVoiceId,
  initialPersonaName,
}: {
  userId: string;
  initialVoiceId: string | null;
  initialPersonaName: string | null;
}) {
  const initialPreset = findVoicePreset(initialVoiceId ?? "") ?? DEFAULT_PRESET;
  const [selectedId, setSelectedId] = useState(initialPreset.id);
  const [personaName, setPersonaName] = useState(initialPersonaName ?? initialPreset.name);
  const [nameTouched, setNameTouched] = useState(!!initialPersonaName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handlePlay(presetId: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingId === presetId) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`/voice-previews/${presetId}.mp3`);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(presetId);
    audio.play();
  }

  function handleSelect(presetId: string) {
    setSelectedId(presetId);
    setStatus("idle");
    if (!nameTouched) {
      const preset = VOICE_PRESETS.find((p) => p.id === presetId);
      if (preset) setPersonaName(preset.name);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const preset = VOICE_PRESETS.find((p) => p.id === selectedId);
    if (!preset || !personaName.trim()) return;

    setStatus("saving");
    setError("");

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("business_profiles")
      .update({
        ai_voice_id: preset.voiceId,
        ai_persona_name: personaName.trim(),
      })
      .eq("user_id", userId);

    if (saveError) {
      setStatus("error");
      setError(saveError.message);
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-rig-700/70">
          Tap ▶ to hear a sample of each voice's tone — it's a generic demo clip, so ignore whatever name it
          says. On a real call, your AI will always introduce itself using the name you set below.
        </p>
        {VOICE_PRESETS.map((preset) => (
          <label
            key={preset.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
              selectedId === preset.id ? "border-rig-900 bg-rig-900/5" : "border-rig-700/20"
            }`}
          >
            <input
              type="radio"
              name="voice-preset"
              value={preset.id}
              checked={selectedId === preset.id}
              onChange={() => handleSelect(preset.id)}
              className="h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-rig-900">
                {preset.name} <span className="text-xs font-normal text-rig-700/60">({preset.gender})</span>
              </p>
              <p className="text-sm text-rig-700">{preset.description}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handlePlay(preset.id);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rig-900/10 text-rig-900 hover:bg-rig-900/20"
              aria-label={playingId === preset.id ? `Stop ${preset.name}` : `Play ${preset.name}`}
            >
              {playingId === preset.id ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M7 4.5v15l13-7.5-13-7.5Z" />
                </svg>
              )}
            </button>
          </label>
        ))}
      </div>

      <div>
        <label className="field-label">What it calls itself</label>
        <input
          value={personaName}
          onChange={(e) => {
            setPersonaName(e.target.value);
            setNameTouched(true);
            setStatus("idle");
          }}
          className="field-input"
          placeholder="Emma"
        />
        <p className="mt-1 text-xs text-rig-700/70">
          E.g. "Hi, it's {personaName || "…"}, the AI Office Manager for your business."
        </p>
      </div>

      {status === "error" && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
      {status === "saved" && <p className="text-sm text-moss-500">Saved.</p>}

      <button type="submit" disabled={status === "saving" || !personaName.trim()} className="btn-primary">
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
