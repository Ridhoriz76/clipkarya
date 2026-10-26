import { segmentsFromWords, type Transcript } from "../transcript";
import { providerFetch } from "./http";
import type { SpeechProvider, TranscriptionProvider, Voice } from "./types";

const BASE = "https://api.elevenlabs.io/v1";

export type ElevenLabsConfig = { apiKey: string; ttsModel: string; sttModel: string };

export function elevenLabsSpeech(cfg: ElevenLabsConfig): SpeechProvider {
  return {
    id: "elevenlabs",
    isDemo: false,
    async listVoices(): Promise<Voice[]> {
      // Voices come from the account's actual voice library (premade + any the user owns).
      const res = await providerFetch(`${BASE}/voices`, { headers: { "xi-api-key": cfg.apiKey } }, { provider: "elevenlabs", timeoutMs: 20_000 });
      const body = (await res.json()) as {
        voices: {
          voice_id: string;
          name: string;
          labels?: Record<string, string>;
          description?: string | null;
          preview_url?: string | null;
        }[];
      };
      return body.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        provider: "elevenlabs",
        language: v.labels?.language ?? null,
        accent: v.labels?.accent ?? null,
        gender: v.labels?.gender ?? null,
        description: v.description ?? v.labels?.description ?? null,
        previewUrl: v.preview_url ?? null,
      }));
    },
    async synthesize({ text, voiceId, speed, language }) {
      const res = await providerFetch(
        `${BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: cfg.ttsModel,
            ...(language ? { language_code: language } : {}),
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, speed ?? 1)) },
          }),
        },
        { provider: "elevenlabs", timeoutMs: 180_000 },
      );
      return {
        audio: new Uint8Array(await res.arrayBuffer()),
        mimeType: "audio/mpeg",
        ext: "mp3",
        usage: { provider: "elevenlabs", operation: "tts", units: text.length, unitType: "characters", estimatedCostUsd: null, model: cfg.ttsModel },
      };
    },
  };
}

type ScribeWord = { text: string; start: number; end: number; type: "word" | "spacing" | "audio_event"; speaker_id?: string | null };

export function elevenLabsTranscription(cfg: ElevenLabsConfig): TranscriptionProvider {
  return {
    id: "elevenlabs",
    isDemo: false,
    maxBytes: 1024 * 1024 * 1024,
    async transcribe({ audio, filename, mimeType, language, diarize, durationSec }) {
      const fd = new FormData();
      fd.append("file", new Blob([audio as BlobPart], { type: mimeType }), filename);
      fd.append("model_id", cfg.sttModel);
      fd.append("timestamps_granularity", "word");
      fd.append("diarize", diarize ? "true" : "false");
      if (language) fd.append("language_code", language);
      const res = await providerFetch(`${BASE}/speech-to-text`, { method: "POST", headers: { "xi-api-key": cfg.apiKey }, body: fd }, {
        provider: "elevenlabs",
        timeoutMs: 20 * 60_000,
        retries: 1,
      });
      const body = (await res.json()) as { text: string; language_code?: string; words?: ScribeWord[] };
      const words = (body.words ?? [])
        .filter((w) => w.type === "word")
        .map((w) => ({ text: w.text.trim(), start: w.start, end: w.end, speaker: w.speaker_id ?? null }));
      const segments = segmentsFromWords(words).map((s) => {
        const first = words.find((w) => w.start >= s.start);
        return { ...s, speaker: first?.speaker ?? null };
      });
      const transcript: Transcript = {
        language: body.language_code ?? language ?? null,
        text: body.text.trim(),
        segments,
        words,
        duration: durationSec ?? (words.length ? words[words.length - 1]!.end : null),
      };
      return {
        transcript,
        usage: { provider: "elevenlabs", operation: "transcription", units: durationSec ?? 0, unitType: "seconds", estimatedCostUsd: null, model: cfg.sttModel },
      };
    },
  };
}
