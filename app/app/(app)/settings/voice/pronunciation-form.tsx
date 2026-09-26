"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Override = { word: string; phonetic: string };

// §pronunciation-fixes — a small, reactive list rather than anything
// fancier: a tradie adds an entry the moment they actually catch Sarah
// mispronouncing something on a real call, so this only ever needs to hold
// a handful of rows. See lib/phone-ai.ts's applyPronunciationOverrides /
// pronunciationInstructions for how these actually get used on a call.
export default function PronunciationForm({
  userId,
  initialOverrides,
}: {
  userId: string;
  initialOverrides: Override[];
}) {
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides.length > 0 ? initialOverrides : [{ word: "", phonetic: "" }]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function updateRow(index: number, field: "word" | "phonetic", value: string) {
    setOverrides((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setStatus("idle");
  }

  function addRow() {
    setOverrides((rows) => [...rows, { word: "", phonetic: "" }]);
  }

  function removeRow(index: number) {
    setOverrides((rows) => rows.filter((_, i) => i !== index));
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    setError("");

    const cleaned = overrides
      .map((row) => ({ word: row.word.trim(), phonetic: row.phonetic.trim() }))
      .filter((row) => row.word && row.phonetic);

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("business_profiles")
      .update({ pronunciation_overrides: cleaned })
      .eq("user_id", userId);

    if (saveError) {
      setStatus("error");
      setError(saveError.message);
      return;
    }
    setOverrides(cleaned.length > 0 ? cleaned : [{ word: "", phonetic: "" }]);
    setStatus("saved");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-rig-700/70">
        Catch Sarah saying something wrong on a call — your business name, a suburb, anything? Add it here with a
        spelling that sounds right out loud, and she'll say it that way instead. This only changes how it's spoken,
        never how it's written in a text or invoice.
      </p>

      {overrides.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row.word}
            onChange={(e) => updateRow(i, "word", e.target.value)}
            className="field-input"
            placeholder="e.g. Woombye"
          />
          <span className="text-rig-700/40">→</span>
          <input
            value={row.phonetic}
            onChange={(e) => updateRow(i, "phonetic", e.target.value)}
            className="field-input"
            placeholder="e.g. Woom-bye"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            aria-label="Remove"
            className="shrink-0 rounded p-2 text-rig-700/50 hover:bg-rust-500/10 hover:text-rust-500"
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" onClick={addRow} className="text-sm font-medium text-steel-500 hover:underline">
        + Add another
      </button>

      {status === "error" && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
      {status === "saved" && <p className="text-sm text-moss-500">Saved.</p>}

      <div>
        <button type="button" onClick={handleSave} disabled={status === "saving"} className="btn-primary">
          {status === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
