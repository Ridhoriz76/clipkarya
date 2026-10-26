import { z } from "zod";
import { ASPECT_RATIOS, RESOLUTIONS } from "./config";

export const JOB_STATUSES = ["queued", "processing", "completed", "failed", "canceled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const AI_JOB_TYPES = [
  "probe",
  "transcription",
  "clip_analysis",
  "voice",
  "script",
  "image",
  "video",
] as const;
export type AiJobType = (typeof AI_JOB_TYPES)[number];

/** BullMQ queue names. One queue per class of work so they can scale separately. */
export const QUEUES = {
  ai: "ck-ai",
  render: "ck-render",
  maintenance: "ck-maintenance",
} as const;

export const jobInputSchemas = {
  probe: z.object({ assetId: z.uuid() }),
  transcription: z.object({
    assetId: z.uuid(),
    language: z.string().min(2).max(8).optional(),
    diarize: z.boolean().default(false),
  }),
  clip_analysis: z.object({
    transcriptId: z.uuid(),
    focus: z.string().max(300).optional(),
    minDuration: z.number().min(5).max(120).default(15),
    maxDuration: z.number().min(10).max(180).default(60),
    maxCandidates: z.number().int().min(1).max(20).default(8),
  }),
  voice: z.object({
    text: z.string().min(1).max(5000),
    voiceId: z.string().min(1).max(100),
    provider: z.enum(["openai", "elevenlabs", "demo"]).optional(),
    speed: z.number().min(0.5).max(2).default(1),
    language: z.string().max(8).optional(),
    /** If set, place the generated audio on the narration track at this time. */
    placeAt: z.number().min(0).optional(),
    sceneId: z.uuid().optional(),
  }),
  script: z.object({
    topic: z.string().min(3).max(1000),
    audience: z.string().max(200).optional(),
    language: z.string().max(20).default("id"),
    durationSec: z.number().int().min(15).max(180).default(45),
    tone: z.string().max(100).default("informatif"),
    niche: z.string().max(100).optional(),
    format: z.enum(["script", "story", "listicle"]).default("script"),
    itemCount: z.number().int().min(3).max(10).optional(),
    criteria: z.string().max(300).optional(),
    reference: z.string().max(8000).optional(),
  }),
  image: z.object({
    prompt: z.string().min(3).max(2000),
    aspectRatio: z.enum(ASPECT_RATIOS).default("9:16"),
    count: z.number().int().min(1).max(4).default(1),
    sceneId: z.uuid().optional(),
  }),
  video: z.object({
    prompt: z.string().min(3).max(2000),
    negativePrompt: z.string().max(1000).optional(),
    style: z.string().max(100).optional(),
    aspectRatio: z.enum(ASPECT_RATIOS).default("9:16"),
    durationSec: z.number().int().min(2).max(15).default(5),
    resolution: z.enum(RESOLUTIONS).default("720p"),
  }),
} satisfies Record<AiJobType, z.ZodType>;

export type JobInput<T extends AiJobType> = z.infer<(typeof jobInputSchemas)[T]>;

export const renderSettingsSchema = z.object({
  resolution: z.enum(RESOLUTIONS),
  burnCaptions: z.boolean().default(true),
  exportSrt: z.boolean().default(true),
  normalizeAudio: z.boolean().default(true),
});
export type RenderSettings = z.infer<typeof renderSettingsSchema>;

export type QueuePayload = { jobId: string; userId: string; kind: "ai" | "render" };

/** Messages surfaced to users must never leak provider internals or secrets. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly code: string = "job_failed",
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;
  return "Terjadi kesalahan saat memproses. Silakan coba lagi atau hubungi dukungan.";
}
