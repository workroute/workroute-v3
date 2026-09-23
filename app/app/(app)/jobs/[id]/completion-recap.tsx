"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// §39 — records the tradie's spoken job recap, uploads it for
// transcription + AI summarising, then lets them review/edit and send it to
// the customer. Recording uses plain MediaRecorder (works on Android and
// iPhone, unlike the Chrome-only Web Speech API used for the client notes
// field) — but Safari's recorder only produces MP4/AAC, which Google's
// speech API doesn't accept, so the recording is decoded and re-encoded as
// a plain WAV file here in the browser before upload. That works
// everywhere because AudioContext.decodeAudioData uses the browser's own
// audio decoders, not tied to what MediaRecorder itself can produce.
function mergeChannels(buffer: AudioBuffer): Float32Array {
  const result = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) result[i] += data[i] / buffer.numberOfChannels;
  }
  return result;
}

function audioBufferToWavBase64(buffer: AudioBuffer): { base64: string; sampleRate: number } {
  const samples = buffer.numberOfChannels > 1 ? mergeChannels(buffer) : buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const dataSize = samples.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { base64: btoa(binary), sampleRate };
}

type Stage = "idle" | "recording" | "processing" | "reviewing" | "sent" | "error";

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card / Eftpos" },
  { value: "payid", label: "PayID" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "invoice_later", label: "Invoice later" },
];

export default function CompletionRecap({
  jobId,
  businessId,
  initialSummary,
  initialSentAt,
  customerEmail,
}: {
  jobId: string;
  businessId: string;
  initialSummary: string | null;
  initialSentAt: string | null;
  customerEmail: string | null;
}) {
  const [stage, setStage] = useState<Stage>(initialSentAt ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [total, setTotal] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(!!customerEmail);
  const [email, setEmail] = useState(customerEmail ?? "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // §next-visit-on-completion — populated only when the AI heard the tradie
  // ask to book the next visit in the same recording. bookingStatus tracks
  // the separate "Book it" action, independent of sending the recap itself.
  const [nextVisitRequested, setNextVisitRequested] = useState(false);
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [nextVisitTime, setNextVisitTime] = useState("");
  const [bookingStatus, setBookingStatus] = useState<"idle" | "booking" | "booked" | "error">("idle");
  const [bookingError, setBookingError] = useState("");
  const [sendWarnings, setSendWarnings] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStopped;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStage("recording");
    } catch {
      setError("Couldn't access the microphone — check your browser's permission settings.");
      setStage("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleRecordingStopped() {
    setStage("processing");
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const { base64, sampleRate } = audioBufferToWavBase64(audioBuffer);
      await audioContext.close();

      const response = await fetch(`/api/jobs/${jobId}/transcribe-completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64, sampleRateHertz: sampleRate }),
      });
      const data = await response.json();

      if (!data.ok) {
        setError(data.error || "Couldn't process that recording.");
        setStage("error");
        return;
      }

      setTranscript(data.transcript);
      setSummary(data.summary);
      setTotal(String(data.total));
      setNextVisitRequested(!!data.nextVisitRequested);
      setNextVisitDate(data.nextVisitDate ?? "");
      setNextVisitTime(data.nextVisitTime ?? "");
      setBookingStatus("idle");
      setStage("reviewing");
    } catch {
      setError("Something went wrong processing that recording.");
      setStage("error");
    }
  }

  // §54 — the after photo, captured right in this same wrap-up flow rather
  // than a separate step on another tab. Uploads immediately on selection,
  // same storage path/pattern as the standalone before/after photos on the
  // Details tab (job-photos.tsx) — this is just a more convenient second
  // entry point into the same completion_photo_path field, not a separate
  // photo slot.
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    setError(null);

    const supabase = createClient();
    const now = new Date();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${businessId}/${jobId}/completion-${now.getTime()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
    if (uploadError) {
      setError(`Couldn't upload photo: ${uploadError.message}`);
      setPhotoUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ completion_photo_path: path, completion_photo_taken_at: now.toISOString() })
      .eq("id", jobId);

    if (updateError) {
      setError(`Couldn't save photo: ${updateError.message}`);
      setPhotoUploading(false);
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(false);
  }

  async function handleBookNextVisit() {
    if (!nextVisitDate) return;
    setBookingStatus("booking");
    setBookingError("");

    const response = await fetch(`/api/jobs/${jobId}/book-next-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: nextVisitDate, time: nextVisitTime || undefined }),
    });
    const data = await response.json();

    if (!data.ok) {
      setBookingStatus("error");
      setBookingError(data.error ?? "Couldn't book that visit.");
      return;
    }
    setBookingStatus("booked");
  }

  async function handleSend() {
    setSending(true);
    setError(null);

    const totalNumber = Number(total);
    if (!summary.trim() || Number.isNaN(totalNumber)) {
      setError("Enter a summary and a valid total before sending.");
      setSending(false);
      return;
    }
    if (!paymentMethod) {
      setError("Select how you were paid before sending.");
      setSending(false);
      return;
    }

    const response = await fetch(`/api/jobs/${jobId}/send-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        paymentMethod,
        total: totalNumber,
        transcript,
        sendSms,
        sendEmail,
        email: sendEmail ? email : null,
      }),
    });
    const data = await response.json();
    setSending(false);

    if (!data.ok) {
      setError(data.error || "Couldn't send that.");
      return;
    }

    const warnings: string[] = [];
    if (sendSms && data.results?.sms?.ok === false) {
      warnings.push(`Text to the customer didn't go out: ${data.results.sms.error ?? "unknown error"}`);
    }
    if (sendEmail && data.results?.email?.ok === false) {
      warnings.push(`Email to the customer didn't go out: ${data.results.email.error ?? "unknown error"}`);
    }
    setSendWarnings(warnings);

    setStage("sent");
  }

  if (stage === "sent") {
    return (
      <div className="rounded-lg border border-moss-500/20 bg-moss-500/10 p-4 text-sm text-moss-500">
        <p className="font-medium">Completion recap sent.</p>
        {summary && <p className="mt-1 text-rig-700">{summary}</p>}
        {sendWarnings.map((w) => (
          <p key={w} className="mt-2 rounded bg-rust-500/10 px-2 py-1.5 text-xs text-rust-500">
            ⚠ {w}
          </p>
        ))}
        <button
          type="button"
          onClick={() => setStage("idle")}
          className="mt-2 text-xs font-medium text-steel-500 hover:underline"
        >
          Record another update
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rig-900/10 bg-white p-4">
      <p className="font-display text-sm font-semibold text-rig-900">Job completion recap</p>
      <p className="mt-1 text-xs text-rig-700/70">
        Talk through what you did and what's needed — WorkRoute will turn it into a summary and total to send the
        customer.
      </p>

      {stage === "idle" && (
        <button type="button" onClick={startRecording} className="btn-primary mt-3 w-full">
          🎤 Record recap
        </button>
      )}

      {stage === "recording" && (
        <button
          type="button"
          onClick={stopRecording}
          className="mt-3 w-full animate-pulse rounded bg-rust-500 px-5 py-3 font-display font-semibold text-white"
        >
          ● Recording — tap to stop
        </button>
      )}

      {stage === "processing" && (
        <p className="mt-3 text-sm text-rig-700">Processing your recording…</p>
      )}

      {stage === "error" && (
        <div className="mt-3">
          <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>
          <button type="button" onClick={startRecording} className="btn-secondary mt-2 w-full">
            Try again
          </button>
        </div>
      )}

      {stage === "reviewing" && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="field-label">Summary for the customer</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="field-input min-h-[80px]"
            />
          </div>
          <div>
            <label className="field-label">Total ($)</label>
            <input
              type="number"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">How did you get paid?</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`rounded border px-3 py-1.5 text-sm font-medium ${
                    paymentMethod === method.value
                      ? "border-amber-600 bg-amber-500 text-rig-950"
                      : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {nextVisitRequested && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-rig-900">Sounds like you want to book their next visit</p>
              {bookingStatus === "booked" ? (
                <p className="mt-1 text-sm text-moss-500">
                  Booked for {nextVisitDate}
                  {nextVisitTime ? ` at ${nextVisitTime}` : ""}.
                </p>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-rig-700/70">Date</label>
                      <input
                        type="date"
                        value={nextVisitDate}
                        onChange={(e) => {
                          setNextVisitDate(e.target.value);
                          setBookingStatus("idle");
                        }}
                        className="field-input mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-rig-700/70">Time (optional)</label>
                      <input
                        type="time"
                        value={nextVisitTime}
                        onChange={(e) => {
                          setNextVisitTime(e.target.value);
                          setBookingStatus("idle");
                        }}
                        className="field-input mt-1"
                      />
                    </div>
                  </div>
                  {bookingStatus === "error" && (
                    <p className="mt-2 rounded bg-rust-500/10 px-2 py-1 text-xs text-rust-500">{bookingError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleBookNextVisit}
                    disabled={!nextVisitDate || bookingStatus === "booking"}
                    className="btn-secondary mt-2 w-full"
                  >
                    {bookingStatus === "booking" ? "Checking…" : "Book it"}
                  </button>
                </>
              )}
            </div>
          )}

          <div>
            <label className="field-label">After photo (optional)</label>
            {photoPreview ? (
              <img src={photoPreview} alt="After photo" className="w-full rounded object-cover" />
            ) : (
              <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-rig-700/25 bg-paper-100 py-4 text-sm text-rig-700/60 hover:bg-paper-100/70">
                {photoUploading ? "Uploading…" : "📷 Add a photo of the finished job"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  disabled={photoUploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-rig-900">
            <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
            Send via SMS / Messenger
          </label>

          <label className="flex items-center gap-2 text-sm text-rig-900">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Email the customer
          </label>
          {sendEmail && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="customer@example.com"
            />
          )}

          {error && <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

          <button type="button" onClick={handleSend} disabled={sending} className="btn-primary w-full">
            {sending ? "Sending…" : "Send to customer"}
          </button>
        </div>
      )}
    </div>
  );
}
