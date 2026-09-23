// §39 — speech-to-text for the tradie's on-the-job voice recap. Reuses the
// same server-only Google Cloud key/project already set up for Maps
// geocoding (GOOGLE_MAPS_API_KEY) — this only needs the "Cloud Speech-to-Text
// API" enabled on that same project, no separate account/key.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function transcribeAudio(
  audioBase64: string,
  sampleRateHertz: number
): Promise<{ ok: true; transcript: string } | { ok: false; error: string }> {
  if (!GOOGLE_MAPS_API_KEY) {
    return { ok: false, error: "Speech-to-text isn't configured yet — missing GOOGLE_MAPS_API_KEY." };
  }

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_MAPS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: "LINEAR16",
          sampleRateHertz,
          languageCode: "en-AU",
          model: "default",
        },
        audio: { content: audioBase64 },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data?.error?.message || "Speech-to-text request failed." };
  }

  const transcript = (data.results ?? [])
    .map((r: { alternatives?: { transcript?: string }[] }) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ")
    .trim();

  if (!transcript) {
    return { ok: false, error: "Didn't catch any speech in that recording." };
  }

  return { ok: true, transcript };
}
