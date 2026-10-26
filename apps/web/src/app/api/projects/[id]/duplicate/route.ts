import { ApiError, json, uuidParam, withAuth } from "@/lib/api";

/** Duplicate a project's settings and timeline (media assets are shared, not copied). */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ ctx, userId, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data: src } = await supabase
    .from("projects")
    .select("title, mode, aspect_ratio, resolution, fps, background, caption_style, settings, template_id, thumbnail_asset_id, source_asset_id")
    .eq("id", id)
    .maybeSingle();
  if (!src) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  const { data: copy, error } = await supabase
    .from("projects")
    .insert({ ...src, user_id: userId, title: `${src.title} (salinan)`.slice(0, 200), status: "draft" })
    .select("id")
    .single<{ id: string }>();
  if (error || !copy) throw new Error(error?.message);
  const { data: doc } = await supabase.rpc("get_timeline", { p_project: id });
  if (doc) await supabase.rpc("save_timeline", { p_project: copy.id, p_expected_version: 0, p_doc: doc });
  return json({ id: copy.id }, 201);
});
