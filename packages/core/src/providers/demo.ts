import type { z } from "zod";
import type { Transcript } from "../transcript";
import { ProviderError } from "./http";
import type { SpeechProvider, TextProvider, TranscriptionProvider, Voice } from "./types";

/**
 * DEMO providers exist only so the pipeline can be exercised locally without API keys.
 * Every output is explicitly labeled "[DEMO]" and flagged isDemo so the UI shows a badge.
 * They never claim to be real AI output.
 */

export const DEMO_LABEL = "[DEMO]";

const DEMO_SENTENCES = [
  "Kenapa kebanyakan orang gagal di minggu pertama?",
  "Ini adalah transkrip demo, bukan hasil AI asli.",
  "Hubungkan penyedia speech-to-text untuk transkripsi nyata.",
  "Rahasia pertama adalah konsistensi setiap hari.",
  "Kalimat ini hanya contoh untuk menguji pemotongan klip.",
  "Tiga tips penting yang jarang dibahas orang.",
  "Penanda waktu dibuat merata, bukan dari audio Anda.",
  "Terima kasih sudah mencoba mode demo.",
];

export function demoTranscription(): TranscriptionProvider {
  return {
    id: "demo",
    isDemo: true,
    maxBytes: Number.MAX_SAFE_INTEGER,
    async transcribe({ durationSec }) {
      const duration = Math.max(5, durationSec ?? 60);
      const words: Transcript["words"] = [];
      const segments: Transcript["segments"] = [];
      let t = 0.3;
      let i = 0;
      while (t < duration - 1) {
        const sentence = `${i % 4 === 0 ? DEMO_LABEL + " " : ""}${DEMO_SENTENCES[i % DEMO_SENTENCES.length]}`;
        const tokens = sentence.split(" ");
        const segStart = t;
        for (const tok of tokens) {
          if (t >= duration - 0.3) break;
          const len = 0.25 + tok.length * 0.035;
          words.push({ text: tok, start: round(t), end: round(Math.min(duration, t + len)) });
          t += len + 0.06;
        }
        segments.push({ start: round(segStart), end: round(Math.min(duration, t)), text: sentence });
        t += 0.5;
        i++;
      }
      return {
        transcript: { language: "id", text: segments.map((s) => s.text).join(" "), segments, words, duration },
        usage: { provider: "demo", operation: "transcription", units: duration, unitType: "seconds", estimatedCostUsd: 0 },
      };
    },
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** 16-bit mono PCM WAV with a soft tone per word — audibly a placeholder, never speech. */
export function demoToneWav(text: string, speed = 1): Uint8Array {
  const sampleRate = 24000;
  const words = text.split(/\s+/).filter(Boolean);
  const wordSec = 0.38 / speed;
  const gapSec = 0.06 / speed;
  const total = Math.max(1, words.length) * (wordSec + gapSec) + 0.3;
  const n = Math.floor(total * sampleRate);
  const data = new Int16Array(n);
  words.forEach((w, i) => {
    const startSample = Math.floor(i * (wordSec + gapSec) * sampleRate);
    const len = Math.floor(wordSec * sampleRate);
    const freq = 320 + (w.length % 6) * 40;
    for (let s = 0; s < len && startSample + s < n; s++) {
      const env = Math.sin((Math.PI * s) / len);
      data[startSample + s] = Math.round(Math.sin((2 * Math.PI * freq * s) / sampleRate) * env * 6000);
    }
  });
  const buf = new ArrayBuffer(44 + data.byteLength);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + data.byteLength, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, data.byteLength, true);
  new Int16Array(buf, 44).set(data);
  return new Uint8Array(buf);
}

export function demoSpeech(): SpeechProvider {
  return {
    id: "demo",
    isDemo: true,
    async listVoices(): Promise<Voice[]> {
      return [{ id: "demo-tone", name: "Demo (nada, bukan suara)", provider: "demo", language: null, description: "Placeholder tone for local testing" }];
    },
    async synthesize({ text, speed }) {
      return {
        audio: demoToneWav(text, speed),
        mimeType: "audio/wav",
        ext: "wav",
        usage: { provider: "demo", operation: "tts", units: text.length, unitType: "characters", estimatedCostUsd: 0 },
      };
    },
  };
}

export function demoText(): TextProvider {
  return {
    id: "demo",
    isDemo: true,
    async generateJson<T>(_opts: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<{ data: T; usage: never }> {
      // Generating fake "AI" text would be misleading; demo text generation is intentionally unavailable.
      throw new ProviderError("demo", "Text generation requires OPENAI_API_KEY or ANTHROPIC_API_KEY");
    },
  };
}
