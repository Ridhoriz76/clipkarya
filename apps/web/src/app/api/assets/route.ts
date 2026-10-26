import { z } from "zod";
import { json, withAuth } from "@/lib/api";
import { signPaths } from "@/lib/media";
import type { AssetDTO } from "@/lib/types";

const query = z.object({
  projectId: z.uuid().optional(),
  kind: z.enum(["video", "audio", "image", "subtitle", "export", "thumbnail"]).optional(),
  source: z.enum(["upload", "tts", "image_gen", "video_gen", "render", "derived"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** List the caller's assets with short-lived signed URLs (RLS restricts rows to the owner). */
export const GET = withAuth(async ({ req, supabase }) => {
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  let sel = supabase
    .from("media_assets")
    .select("id, kind, status, source, original_name, mime_type, size_bytes, duration_sec, width, height, has_audio, is_demo, project_id, created_at, storage_path, thumbnail_path")
    .neq("kind", "thumbnail")
    .order("created_at", { ascending: false })
    .limit(q.limit);
  if (q.projectId) sel = sel.eq("project_id", q.projectId);
  if (q.kind) sel = sel.eq("kind", q.kind);
  if (q.source) sel = sel.eq("source", q.source);
  const { data, error } = await sel;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const urls = await signPaths(rows.flatMap((r) => [r.status === "ready" ? r.storage_path : null, r.thumbnail_path]));
  const assets: AssetDTO[] = rows.map(({ storage_path, thumbnail_path, ...r }) => ({
    ...r,
    url: r.status === "ready" ? (urls[storage_path] ?? null) : null,
    thumbnailUrl: thumbnail_path ? (urls[thumbnail_path] ?? null) : null,
  }));
  return json({ assets });
});
