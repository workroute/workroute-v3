"use client";

import { useEffect, useRef, useState } from "react";

// §21 — the Web Speech API isn't in TS's default DOM lib, and it's only
// available as a vendor-prefixed constructor in most browsers. Just the
// bits this component actually uses.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// §21 — voice-to-text for the notes field: plain transcription straight
// into the box, no parsing. Chrome-family only; degrades to a brief note
// elsewhere (no backend/API key involved, same as SameNot's approach).
export default function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function handleClick() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access denied."
          : event.error === "no-speech"
            ? "Didn't catch that — try again."
            : "Voice input failed."
      );
      setTimeout(() => setError(null), 4000);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  }

  if (!supported) {
    return <p className="text-xs text-rig-700/50">Voice input needs Chrome</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        title={listening ? "Stop voice input" : "Speak your notes"}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${
          listening
            ? "animate-pulse border-rust-500 bg-rust-500/10 text-rust-500"
            : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
        }`}
      >
        🎤
      </button>
      {listening && <span className="text-xs text-rig-700/70">Listening…</span>}
      {error && <span className="text-xs text-rust-500">{error}</span>}
    </div>
  );
}
