/** DTOs shared between API routes and client components. */
export type AssetDTO = {
  id: string;
  kind: string;
  status: string;
  source: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  has_audio: boolean | null;
  is_demo: boolean;
  project_id: string | null;
  created_at: string;
  url: string | null;
  thumbnailUrl: string | null;
};

export type JobDTO = {
  id: string;
  kind: "ai" | "render";
  type: string;
  status: "queued" | "processing" | "completed" | "failed" | "canceled";
  progress: number;
  stage: string | null;
  error_message: string | null;
  credits_cost: number;
  is_demo?: boolean;
  output?: Record<string, unknown> | null;
  output_asset_id?: string | null;
  srt_asset_id?: string | null;
  project_id: string | null;
  created_at: string;
  completed_at: string | null;
  settings?: Record<string, unknown> | null;
};

export type ClipDTO = {
  id: string;
  title: string;
  start_sec: number;
  end_sec: number;
  transcript_excerpt: string;
  hook_text: string;
  score: number;
  score_breakdown: Record<string, number | null>;
  reasons: string[];
  status: string;
  derived_project_id: string | null;
  thumbnailUrl: string | null;
};

export type TranscriptDTO = {
  id: string;
  asset_id: string;
  provider: string;
  language: string | null;
  text: string;
  segments: { start: number; end: number; text: string; speaker?: string | null }[];
  words: { text: string; start: number; end: number; speaker?: string | null }[];
  is_demo: boolean;
  edited: boolean;
  created_at: string;
};

export type SceneDTO = {
  id: string;
  position: number;
  title: string;
  narration: string;
  visual_description: string;
  on_screen_text: string;
  duration_sec: number;
  needs_verification: boolean;
  image_asset_id: string | null;
  voice_asset_id: string | null;
  imageUrl?: string | null;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
  voiceIsDemo?: boolean;
};

export type VoiceDTO = {
  id: string;
  name: string;
  provider: string;
  language?: string | null;
  accent?: string | null;
  gender?: string | null;
  description?: string | null;
  previewUrl?: string | null;
  isDemo: boolean;
};
