import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  WORKER_TMP_DIR: z.string().default("/tmp/clipkarya"),
  WORKER_AI_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  WORKER_RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
  FFMPEG_PRESET: z.string().default("veryfast"),
  FONTS_DIR: z.string().optional(),
  RENDER_TIMEOUT_SEC: z.coerce.number().int().min(60).default(3600),
});

export type WorkerEnv = z.infer<typeof schema>;

let cached: WorkerEnv | null = null;
export function env(): WorkerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      console.error("[worker] Invalid environment:", z.prettifyError(parsed.error));
      process.exit(1);
    }
    cached = parsed.data;
  }
  return cached;
}
