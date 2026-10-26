import { timelineFromScenes, type CaptionStyle } from "@clipkarya/core";
import { ApiError, json, uuidParam, withAuth } from "@/lib/api";

/** Build the editor timeline from the project's scenes (visuals, voiceover, on-screen text, captions). */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data: project } = await supabase.from("projects").select("id, aspect_ratio, resolution, caption_style, timeline_version").eq("id", id).maybeSingle();
  if (!project) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  const { data: scenes } = await supabase
    .from("project_scenes")
    .select("narration, on_screen_text, duration_sec, image_asset_id, video_asset_id, voice:media_assets!project_scenes_voice_asset_id_fkey(id, duration_sec)")
    .eq("project_id", id)
    .order("position");
  if (!scenes?.length) throw new ApiError(422, "Belum ada scene.", "no_scenes");
  const rows = scenes as unknown as {
    narration: string;
    on_screen_text: string;
    duration_sec: number;
    image_asset_id: string | null;
    video_asset_id: string | null;
    voice: { id: string; duration_sec: number | null } | null;
  }[];
  const style = project.caption_style && Object.keys(project.caption_style).length ? (project.caption_style as CaptionStyle) : undefined;
  const timeline = timelineFromScenes(
    rows.map((s) => ({
      narration: s.narration,
      onScreenText: s.on_screen_text,
      durationSec: s.duration_sec,
      imageAssetId: s.image_asset_id,
      videoAssetId: s.video_asset_id,
      voiceAssetId: s.voice?.id ?? null,
      voiceDurationSec: s.voice?.duration_sec ?? null,
    })),
    { aspectRatio: project.aspect_ratio, resolution: project.resolution, captionStyle: style },
  );
  const { error } = await supabase.rpc("save_timeline", { p_project: id, p_expected_version: project.timeline_version, p_doc: timeline });
  if (error) throw new Error(error.message);
  const firstVisual = rows.find((r) => r.image_asset_id)?.image_asset_id;
  if (firstVisual) await supabase.from("projects").update({ thumbnail_asset_id: firstVisual }).eq("id", id);
  return json({ ok: true });
});
