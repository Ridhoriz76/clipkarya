import { ASPECT_RATIOS, captionStyleSchema, DEFAULT_CAPTION_STYLE, emptyTimeline, RESOLUTIONS, TEMPLATES } from "@clipkarya/core";
import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";

const MODES = ["editor", "auto_clip", "script_to_video", "text_story", "video_story", "commentary", "split_screen", "listicle", "transcriber"] as const;

const createBody = z.object({
  title: z.string().trim().min(1).max(200).default("Proyek tanpa judul"),
  mode: z.enum(MODES).default("editor"),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  resolution: z.enum(RESOLUTIONS).default("1080p"),
  templateId: z.string().max(60).optional(),
  autoClip: z
    .object({
      language: z.string().max(8).optional(),
      focus: z.string().max(300).optional(),
      minDuration: z.number().int().min(5).max(120).default(15),
      maxDuration: z.number().int().min(10).max(180).default(60),
      maxCandidates: z.number().int().min(1).max(20).default(8),
    })
    .optional(),
});

export const GET = withAuth(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, mode, status, aspect_ratio, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ projects: data });
});

export const POST = withAuth(async ({ req, userId, supabase }) => {
  const b = await parseBody(req, createBody);
  const template = TEMPLATES.find((t) => t.id === b.templateId);
  // An explicit choice wins over the template's suggested ratio.
  const aspectRatio = b.aspectRatio ?? template?.aspectRatio ?? "9:16";
  const { data: kit } = await supabase
    .from("brand_kits")
    .select("id, caption_preset")
    .eq("is_default", true)
    .maybeSingle<{ id: string; caption_preset: Record<string, unknown> }>();
  // Template style wins; otherwise the user's brand-kit caption preset over the defaults.
  const captionStyle = template?.captionStyle ?? captionStyleSchema.parse({ ...DEFAULT_CAPTION_STYLE, ...(kit?.caption_preset ?? {}) });
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: b.title,
      mode: b.mode,
      aspect_ratio: aspectRatio,
      resolution: b.resolution,
      caption_style: captionStyle,
      template_id: template?.id ?? null,
      brand_kit_id: kit?.id ?? null,
      settings: b.autoClip ? { autoClip: { ...b.autoClip, autoPipeline: true } } : {},
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !project) throw new Error(error?.message);
  const tl = { ...emptyTimeline(aspectRatio, b.resolution), captionStyle };
  const { error: tErr } = await supabase.rpc("save_timeline", { p_project: project.id, p_expected_version: 0, p_doc: tl });
  if (tErr) throw new Error(tErr.message);
  return json({ id: project.id }, 201);
});
