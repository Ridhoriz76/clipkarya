import { STORAGE_BUCKET } from "@clipkarya/core";
import { ApiError, json, uuidParam, withAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

/** Delete a media asset and its stored files. Refuses if the asset is used in a timeline. */
export const DELETE = withAuth<Params>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, storage_path, thumbnail_path")
    .eq("id", id)
    .maybeSingle<{ id: string; storage_path: string; thumbnail_path: string | null }>();
  if (!asset) throw new ApiError(404, "Media tidak ditemukan.", "not_found");
  const { count } = await supabase.from("timeline_items").select("id", { count: "exact", head: true }).eq("asset_id", id);
  if (count) throw new ApiError(409, "Media masih dipakai di timeline. Hapus dari timeline terlebih dahulu.", "in_use");
  await createAdminClient()
    .storage.from(STORAGE_BUCKET)
    .remove([asset.storage_path, ...(asset.thumbnail_path ? [asset.thumbnail_path] : [])]);
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
