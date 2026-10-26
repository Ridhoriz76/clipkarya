import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";

const patchBody = z
  .object({
    title: z.string().trim().max(200).optional(),
    start_sec: z.number().min(0).optional(),
    end_sec: z.number().min(0).optional(),
    status: z.enum(["suggested", "selected", "dismissed"]).optional(),
  })
  .refine((b) => b.start_sec === undefined || b.end_sec === undefined || b.end_sec - b.start_sec >= 1, "Durasi klip minimal 1 detik.");

/** Adjust a suggested clip's timestamps/title/status. */
export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, patchBody);
  const { data: clip } = await supabase
    .from("video_clips")
    .select("start_sec, end_sec, source:media_assets!video_clips_source_asset_id_fkey(duration_sec)")
    .eq("id", id)
    .maybeSingle<{ start_sec: number; end_sec: number; source: { duration_sec: number | null } | null }>();
  if (!clip) throw new ApiError(404, "Klip tidak ditemukan.", "not_found");
  const start = b.start_sec ?? clip.start_sec;
  const end = b.end_sec ?? clip.end_sec;
  const max = clip.source?.duration_sec ?? Infinity;
  if (end - start < 1) throw new ApiError(422, "Durasi klip minimal 1 detik.", "invalid_range");
  if (end > max + 0.05) throw new ApiError(422, "Akhir klip melebihi durasi video.", "invalid_range");
  const { error } = await supabase.from("video_clips").update(b).eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
