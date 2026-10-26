import type { z } from "zod";
import { segmentsFromWords, type Transcript } from "../transcript";
import { providerFetch, ProviderError } from "./http";
import { extractJson } from "./json";
import type { ImageProvider, SpeechProvider, TextProvider, TranscriptionProvider, Voice } from "./types";

const BASE = "https://api.openai.com/v1";

export type OpenAIConfig = {
  apiKey: string;
  textModel: string;
  transcribeModel: string;
  ttsModel: string;
  imageModel: string;
};

function headers(cfg: OpenAIConfig, json = true): Record<string, string> {
  return { Authorization: `Bearer ${cfg.apiKey}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

export function openAIText(cfg: OpenAIConfig): TextProvider {
  return {
    id: "openai",
    isDemo: false,
    async generateJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; maxTokens?: number }) {
      const res = await providerFetch(
        `${BASE}/chat/completions`,
        {
          method: "POST",
          headers: headers(cfg),
          body: JSON.stringify({
            model: cfg.textModel,
            response_format: { type: "json_object" },
            max_completion_tokens: opts.maxTokens ?? 4000,
            messages: [
              { role: "system", content: `${opts.system}\nRespond with a single JSON object only.` },
              { role: "user", content: opts.prompt },
            ],
          }),
        },
        { provider: "openai", timeoutMs: 120_000 },
      );
      const body = (await res.json()) as {
        choices: { message: { content: string | null } }[];
        usage?: { total_tokens?: number };
      };
      const content = body.choices[0]?.message.content ?? "";
      const parsed = opts.schema.safeParse(extractJson(content));
      if (!parsed.success) throw new ProviderError("openai", `Invalid JSON shape: ${parsed.error.message.slice(0, 300)}`);
      return {
        data: parsed.data,
        usage: { provider: "openai", operation: "text", units: body.usage?.total_tokens ?? 0, unitType: "tokens", estimatedCostUsd: null, model: cfg.textModel },
      };
    },
  };
}

type VerboseTranscription = {
  language?: string;
  duration?: number;
  text: string;
  segments?: { start: number; end: number; text: string }[];
  words?: { word: string; start: number; end: number }[];
};

export function openAITranscription(cfg: OpenAIConfig): TranscriptionProvider {
  return {
    id: "openai",
    isDemo: false,
    maxBytes: 25 * 1024 * 1024,
    async transcribe({ audio, filename, mimeType, language, durationSec }) {
      const form = () => {
        const fd = new FormData();
        fd.append("file", new Blob([audio as BlobPart], { type: mimeType }), filename);
        fd.append("model", cfg.transcribeModel);
        // whisper-1 is the OpenAI model that returns word + segment timestamps (verbose_json).
        fd.append("response_format", "verbose_json");
        fd.append("timestamp_granularities[]", "word");
        fd.append("timestamp_granularities[]", "segment");
        if (language) fd.append("language", language);
        return fd;
      };
      const res = await providerFetch(`${BASE}/audio/transcriptions`, { method: "POST", headers: headers(cfg, false), body: form() }, {
        provider: "openai",
        timeoutMs: 15 * 60_000,
        retries: 1,
      });
      const body = (await res.json()) as VerboseTranscription;
      const words = (body.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
      const segments = body.segments?.length
        ? body.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }))
        : segmentsFromWords(words);
      const transcript: Transcript = {
        language: body.language ?? language ?? null,
        text: body.text.trim(),
        segments,
        words,
        duration: body.duration ?? durationSec ?? null,
      };
      const seconds = body.duration ?? durationSec ?? 0;
      return {
        transcript,
        usage: { provider: "openai", operation: "transcription", units: seconds, unitType: "seconds", estimatedCostUsd: (seconds / 60) * 0.006, model: cfg.transcribeModel },
      };
    },
  };
}

/** Voices documented for OpenAI's speech endpoint. Not every voice suits every model. */
const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];

export function openAISpeech(cfg: OpenAIConfig): SpeechProvider {
  return {
    id: "openai",
    isDemo: false,
    async listVoices(): Promise<Voice[]> {
      return OPENAI_VOICES.map((v) => ({
        id: v,
        name: v[0]!.toUpperCase() + v.slice(1),
        provider: "openai",
        language: "multilingual",
        description: `OpenAI ${cfg.ttsModel}`,
      }));
    },
    async synthesize({ text, voiceId, speed }) {
      const res = await providerFetch(
        `${BASE}/audio/speech`,
        {
          method: "POST",
          headers: headers(cfg),
          body: JSON.stringify({ model: cfg.ttsModel, voice: voiceId, input: text, response_format: "mp3", speed: speed ?? 1 }),
        },
        { provider: "openai", timeoutMs: 180_000 },
      );
      const audio = new Uint8Array(await res.arrayBuffer());
      return {
        audio,
        mimeType: "audio/mpeg",
        ext: "mp3",
        usage: { provider: "openai", operation: "tts", units: text.length, unitType: "characters", estimatedCostUsd: null, model: cfg.ttsModel },
      };
    },
  };
}

const IMAGE_SIZES = { "9:16": "1024x1536", "16:9": "1536x1024", "1:1": "1024x1024" } as const;

export function openAIImage(cfg: OpenAIConfig): ImageProvider {
  return {
    id: "openai",
    isDemo: false,
    async generate({ prompt, aspectRatio, count }) {
      const res = await providerFetch(
        `${BASE}/images/generations`,
        {
          method: "POST",
          headers: headers(cfg),
          body: JSON.stringify({ model: cfg.imageModel, prompt, n: count, size: IMAGE_SIZES[aspectRatio] }),
        },
        { provider: "openai", timeoutMs: 240_000, retries: 1 },
      );
      const body = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
      const images = await Promise.all(
        body.data.map(async (d) => {
          if (d.b64_json) return { data: Uint8Array.from(Buffer.from(d.b64_json, "base64")), mimeType: "image/png", ext: "png" };
          if (d.url) {
            const r = await providerFetch(d.url, {}, { provider: "openai" });
            return { data: new Uint8Array(await r.arrayBuffer()), mimeType: "image/png", ext: "png" };
          }
          throw new ProviderError("openai", "Image response contained no data");
        }),
      );
      return {
        images,
        usage: { provider: "openai", operation: "image", units: images.length, unitType: "images", estimatedCostUsd: null, model: cfg.imageModel },
      };
    },
  };
}
