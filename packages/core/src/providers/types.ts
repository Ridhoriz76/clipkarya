import type { z } from "zod";
import type { AspectRatio } from "../config";
import type { Transcript } from "../transcript";

export type ProviderUsage = {
  provider: string;
  operation: string;
  units: number;
  unitType: "tokens" | "seconds" | "characters" | "images" | "requests";
  /** Best-effort USD estimate from public pricing; null when unknown. */
  estimatedCostUsd: number | null;
  model?: string;
};

export type ProviderStatus = {
  id: string;
  label: string;
  capability: Capability;
  configured: boolean;
  isDemo: boolean;
  missingEnv: string[];
  model?: string;
};

export type Capability = "text" | "transcription" | "speech" | "image" | "video";

export interface TextProvider {
  id: string;
  isDemo: boolean;
  generateJson<T>(opts: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    maxTokens?: number;
  }): Promise<{ data: T; usage: ProviderUsage }>;
}

export interface TranscriptionProvider {
  id: string;
  isDemo: boolean;
  /** maxBytes is the provider's upload limit; callers compress audio below it. */
  maxBytes: number;
  transcribe(opts: {
    audio: Uint8Array;
    filename: string;
    mimeType: string;
    language?: string;
    diarize?: boolean;
    durationSec?: number;
  }): Promise<{ transcript: Transcript; usage: ProviderUsage }>;
}

export type Voice = {
  id: string;
  name: string;
  provider: string;
  language?: string | null;
  accent?: string | null;
  gender?: string | null;
  description?: string | null;
  previewUrl?: string | null;
};

export interface SpeechProvider {
  id: string;
  isDemo: boolean;
  listVoices(): Promise<Voice[]>;
  synthesize(opts: { text: string; voiceId: string; speed?: number; language?: string }): Promise<{
    audio: Uint8Array;
    mimeType: string;
    ext: string;
    usage: ProviderUsage;
  }>;
}

export interface ImageProvider {
  id: string;
  isDemo: boolean;
  generate(opts: { prompt: string; aspectRatio: AspectRatio; count: number }): Promise<{
    images: { data: Uint8Array; mimeType: string; ext: string }[];
    usage: ProviderUsage;
  }>;
}

export type VideoJobState =
  | { state: "queued" | "processing"; progress?: number | null; queuePosition?: number | null }
  | { state: "completed"; videoUrl: string }
  | { state: "failed"; error: string };

export interface VideoProvider {
  id: string;
  isDemo: boolean;
  submit(opts: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio: AspectRatio;
    durationSec: number;
    resolution: "720p" | "1080p";
  }): Promise<{ requestId: string; usage: ProviderUsage }>;
  poll(requestId: string): Promise<VideoJobState>;
}
