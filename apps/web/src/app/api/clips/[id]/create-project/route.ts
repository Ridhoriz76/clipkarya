import { timelineFromClip, TEMPLATES, type CaptionStyle } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";

const body = z.object({
  captions: z.boolean().default(true),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  templateId: z.string().max(60).optional(),
});

/** Turn a clip suggestion into its own editable project (vertical crop + timed captions). */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, userId, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, body);
  const { data: clip } = await supabase
    .from("video_clips")
    .select("id, title, start_sec, end_sec, source_asset_id, transcript_id, project_id")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; start_sec: number; end_sec: number; source_asset_id: string; transcript_id: string | null; project_id: string }>();
  if (!clip) throw new ApiError(404, "Klip tidak ditemukan.", "not_found");

  const { data: parent } = await supabase.from("projects").select("title, caption_style, resolution").eq("id", clip.project_id).single();
  const transcript = clip.transcript_id
    ? (await supabase.from("transcripts").select("segments, words").eq("id", clip.transcript_id).maybeSingle()).data
    : null;
  const template = TEMPLATES.find((t) => t.id === b.templateId);
  const parentStyle = parent?.caption_style && Object.keys(parent.caption_style).length ? (parent.caption_style as CaptionStyle) : undefined;
  const timeline = timelineFromClip({
    assetId: clip.source_asset_id,
    start: clip.start_sec,
    end: clip.end_sec,
    transcript: b.captions ? transcript : null,
    aspectRatio: b.aspectRatio,
    resolution: (parent?.resolution as "720p" | "1080p") ?? "1080p",
    captionStyle: template?.captionStyle ?? parentStyle,
  });

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: (clip.title || `${parent?.title ?? "Klip"}`).slice(0, 200),
      mode: "editor",
      aspect_ratio: timeline.aspectRatio,
      resolution: timeline.resolution,
      caption_style: timeline.captionStyle,
      source_asset_id: clip.source_asset_id,
      thumbnail_asset_id: clip.source_asset_id,
      settings: { fromClipId: clip.id, parentProjectId: clip.project_id },
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !project) throw new Error(error?.message);
  const { error: tErr } = await supabase.rpc("save_timeline", { p_project: project.id, p_expected_version: 0, p_doc: timeline });
  if (tErr) throw new Error(tErr.message);
  await supabase.from("video_clips").update({ status: "selected", derived_project_id: project.id }).eq("id", clip.id);
  return json({ projectId: project.id }, 201);
});
