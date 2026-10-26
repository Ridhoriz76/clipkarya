/**
 * Product-wide constants. The product name is configurable through
 * NEXT_PUBLIC_APP_NAME so the brand can change without code edits.
 */
export const DEFAULT_APP_NAME = "ClipKarya AI";

export function getAppName(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME;
}

export const ASPECT_RATIOS = ["9:16", "16:9", "1:1"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const RESOLUTIONS = ["720p", "1080p"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "9:16": "9:16 · TikTok, Reels, Shorts",
  "16:9": "16:9 · Landscape / YouTube",
  "1:1": "1:1 · Square feed",
};

/** Output frame size for an aspect ratio at a resolution tier (short side = tier). */
export function frameSize(aspectRatio: AspectRatio, resolution: Resolution): { width: number; height: number } {
  const short = resolution === "1080p" ? 1080 : 720;
  const long = resolution === "1080p" ? 1920 : 1280;
  switch (aspectRatio) {
    case "9:16":
      return { width: short, height: long };
    case "16:9":
      return { width: long, height: short };
    case "1:1":
      return { width: short, height: short };
  }
}

/** Upload limits. Plans may lower these further (see subscription_plans). */
export const UPLOAD_LIMITS = {
  maxBytes: 2 * 1024 * 1024 * 1024, // 2 GB hard ceiling
  maxDurationSec: 3 * 60 * 60, // 3 hours
  allowedMime: {
    video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
    audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/aac", "audio/x-m4a"],
    image: ["image/png", "image/jpeg", "image/webp"],
  },
} as const;

export type MediaKind = "video" | "audio" | "image" | "subtitle" | "export" | "thumbnail";

export function mediaKindFromMime(mime: string): "video" | "audio" | "image" | null {
  const m = mime.toLowerCase();
  if ((UPLOAD_LIMITS.allowedMime.video as readonly string[]).includes(m)) return "video";
  if ((UPLOAD_LIMITS.allowedMime.audio as readonly string[]).includes(m)) return "audio";
  if ((UPLOAD_LIMITS.allowedMime.image as readonly string[]).includes(m)) return "image";
  return null;
}

export const STORAGE_BUCKET = "media";

/** Storage keys are always prefixed with the owner's user id; storage RLS relies on it. */
export function storagePath(userId: string, assetId: string, ext: string, projectId?: string | null): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "bin";
  return `${userId}/${projectId ?? "library"}/${assetId}.${safeExt}`;
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "text/plain": "txt",
    "application/x-subrip": "srt",
    "text/vtt": "vtt",
  };
  return map[mime.toLowerCase()] ?? "bin";
}
