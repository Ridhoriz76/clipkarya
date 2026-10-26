import type { AiJobType, JobInput } from "./jobs";

/**
 * Credit pricing. 1 credit ≈ a small unit of provider cost; tune via env or the admin
 * table later. Credits are reserved up-front and refunded automatically on failure.
 */
export const CREDIT_COSTS = {
  probe: 0,
  transcriptionPerMinute: 1,
  clipAnalysis: 2,
  voicePer500Chars: 1,
  script: 2,
  imageEach: 3,
  videoPerSecond: 4,
  renderPerMinute720: 1,
  renderPerMinute1080: 2,
} as const;

export function estimateAiJobCredits<T extends AiJobType>(
  type: T,
  input: JobInput<T>,
  ctx: { mediaDurationSec?: number } = {},
): number {
  switch (type) {
    case "probe":
      return 0;
    case "transcription":
      return Math.max(1, Math.ceil((ctx.mediaDurationSec ?? 60) / 60) * CREDIT_COSTS.transcriptionPerMinute);
    case "clip_analysis":
      return CREDIT_COSTS.clipAnalysis;
    case "voice": {
      const text = (input as JobInput<"voice">).text;
      return Math.max(1, Math.ceil(text.length / 500) * CREDIT_COSTS.voicePer500Chars);
    }
    case "script":
      return CREDIT_COSTS.script;
    case "image":
      return CREDIT_COSTS.imageEach * (input as JobInput<"image">).count;
    case "video":
      return CREDIT_COSTS.videoPerSecond * (input as JobInput<"video">).durationSec;
    default:
      return 1;
  }
}

export function estimateRenderCredits(durationSec: number, resolution: "720p" | "1080p"): number {
  const perMin = resolution === "1080p" ? CREDIT_COSTS.renderPerMinute1080 : CREDIT_COSTS.renderPerMinute720;
  return Math.max(1, Math.ceil(durationSec / 60) * perMin);
}

/**
 * Free mode (default): no prices, plans or credit charges. Set NEXT_PUBLIC_FREE_MODE=false
 * to switch the credit system back on. Shared by web (server + client) and worker.
 */
export function isFreeMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_FREE_MODE?.trim().toLowerCase() !== "false";
}

/**
 * Fair-use caps per user per 24 hours, applied in free mode to keep AI provider costs
 * bounded. Probe and pipeline follow-ups are not counted (they follow a user's upload).
 */
export const FREE_DAILY_LIMITS: Record<AiJobType | "render", number> = {
  probe: 1000,
  transcription: 20,
  clip_analysis: 20,
  voice: 50,
  script: 30,
  image: 40,
  video: 5,
  render: 30,
};
