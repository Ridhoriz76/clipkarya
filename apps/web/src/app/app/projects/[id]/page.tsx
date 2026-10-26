import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import { AutoClipWorkspace } from "@/components/projects/auto-clip-workspace";
import { ScriptWorkspace } from "@/components/projects/script-workspace";
import { TranscriptWorkspace } from "@/components/projects/transcript-workspace";
import type { ClipDTO, SceneDTO, TranscriptDTO } from "@/lib/types";
import { capabilityAvailability } from "@clipkarya/core/providers";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, mode, status, aspect_ratio, settings, source_asset_id")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; mode: string; status: string; aspect_ratio: string; settings: Record<string, unknown>; source_asset_id: string | null }>();
  if (!project) notFound();

  if (["script_to_video", "text_story", "listicle"].includes(project.mode)) {
    const { data: scenes } = await supabase
      .from("project_scenes")
      .select("id, position, title, narration, visual_description, on_screen_text, duration_sec, needs_verification, image_asset_id, voice_asset_id, image:media_assets!project_scenes_image_asset_id_fkey(storage_path), voice:media_assets!project_scenes_voice_asset_id_fkey(storage_path, duration_sec, is_demo)")
      .eq("project_id", id)
      .order("position");
    type Row = SceneDTO & { image: { storage_path: string } | null; voice: { storage_path: string; duration_sec: number | null; is_demo: boolean } | null };
    const rows = (scenes ?? []) as unknown as Row[];
    const urls = await signPaths(rows.flatMap((r) => [r.image?.storage_path, r.voice?.storage_path]), 4 * 3600);
    const dto: SceneDTO[] = rows.map(({ image, voice, ...r }) => ({
      ...r,
      imageUrl: image ? (urls[image.storage_path] ?? null) : null,
      voiceUrl: voice ? (urls[voice.storage_path] ?? null) : null,
      voiceDuration: voice?.duration_sec ?? null,
      voiceIsDemo: voice?.is_demo ?? false,
    }));
    return <ScriptWorkspace project={project} scenes={dto} caps={capabilityAvailability()} />;
  }
  if (project.mode !== "auto_clip" && project.mode !== "transcriber") redirect(`/app/projects/${id}/edit`);

  const { data: source } = project.source_asset_id
    ? await supabase
        .from("media_assets")
        .select("id, status, storage_path, duration_sec, width, height, original_name, is_demo, metadata")
        .eq("id", project.source_asset_id)
        .maybeSingle()
    : { data: null };
  const { data: transcript } = source
    ? await supabase
        .from("transcripts")
        .select("id, asset_id, provider, language, text, segments, words, is_demo, edited, created_at")
        .eq("asset_id", source.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<TranscriptDTO>()
    : { data: null };

  const { data: clipRows } = await supabase
    .from("video_clips")
    .select("id, title, start_sec, end_sec, transcript_excerpt, hook_text, score, score_breakdown, reasons, status, derived_project_id, thumb:media_assets!video_clips_thumbnail_asset_id_fkey(storage_path)")
    .eq("project_id", id)
    .neq("status", "dismissed")
    .order("score", { ascending: false });
  const clipsRaw = (clipRows ?? []) as unknown as (Omit<ClipDTO, "thumbnailUrl"> & { thumb: { storage_path: string } | null })[];
  const urls = await signPaths([source?.status === "ready" ? source.storage_path : null, ...clipsRaw.map((c) => c.thumb?.storage_path)], 4 * 3600);
  const clips: ClipDTO[] = clipsRaw.map(({ thumb, ...c }) => ({ ...c, thumbnailUrl: thumb ? (urls[thumb.storage_path] ?? null) : null }));
  const sourceDto = source
    ? { id: source.id, status: source.status, duration: source.duration_sec, name: source.original_name, url: source.status === "ready" ? (urls[source.storage_path] ?? null) : null }
    : null;

  if (project.mode === "transcriber") return <TranscriptWorkspace project={project} source={sourceDto} transcript={transcript} />;
  return <AutoClipWorkspace project={project} source={sourceDto} transcript={transcript} clips={clips} />;
}
