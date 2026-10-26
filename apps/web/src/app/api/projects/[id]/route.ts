import { STORAGE_BUCKET } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

const patchBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["draft", "ready", "archived"]).optional(),
});

export const PATCH = withAuth<Params>(async ({ req, ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, patchBody);
  const { data, error } = await supabase.from("projects").update(b).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  return json({ ok: true });
});

/** Delete a project, its rows (cascade) and every stored file belonging to it. */
export const DELETE = withAuth<Params>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data: project } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (!project) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  const { data: assets } = await supabase.from("media_assets").select("storage_path, thumbnail_path").eq("project_id", id);
  const paths = (assets ?? []).flatMap((a) => [a.storage_path, a.thumbnail_path]).filter((p): p is string => Boolean(p));
  const admin = createAdminClient();
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from(STORAGE_BUCKET).remove(paths.slice(i, i + 100));
  // Timeline items reference assets with ON DELETE RESTRICT, so clear the timeline first.
  await supabase.rpc("save_timeline", { p_project: id, p_expected_version: null, p_doc: { tracks: [], items: [] } });
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
