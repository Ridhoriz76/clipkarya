import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";

const scene = z.object({
  id: z.uuid().optional(),
  title: z.string().max(200),
  narration: z.string().max(3000),
  visual_description: z.string().max(2000),
  on_screen_text: z.string().max(300),
  duration_sec: z.number().min(1).max(60),
  needs_verification: z.boolean().default(false),
  image_asset_id: z.uuid().nullable().optional(),
  voice_asset_id: z.uuid().nullable().optional(),
});
const body = z.object({ scenes: z.array(scene).max(30) });

/** Replace the project's scene list (order = array order). Keeps generated asset links for existing scenes. */
export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, userId, supabase }) => {
  const projectId = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, body);
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  const keep = b.scenes.filter((s) => s.id).map((s) => s.id!);
  let del = supabase.from("project_scenes").delete().eq("project_id", projectId);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  await del;
  for (const [position, s] of b.scenes.entries()) {
    const row = { ...s, position, project_id: projectId, user_id: userId };
    const res = s.id ? await supabase.from("project_scenes").update(row).eq("id", s.id) : await supabase.from("project_scenes").insert(row);
    if (res.error) throw new Error(res.error.message);
  }
  return json({ ok: true });
});
