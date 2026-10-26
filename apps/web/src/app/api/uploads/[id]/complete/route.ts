import { STORAGE_BUCKET } from "@clipkarya/core";
import { ApiError, json, uuidParam, withAuth } from "@/lib/api";
import { createAiJob } from "@/lib/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/** Step 2: confirm the object exists, then queue an FFprobe validation job. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ ctx, userId, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, storage_path, status, project_id")
    .eq("id", id)
    .maybeSingle<{ id: string; storage_path: string; status: string; project_id: string | null }>();
  if (!asset) throw new ApiError(404, "Media tidak ditemukan.", "not_found");
  if (asset.status !== "pending_upload") return json({ assetId: id, status: asset.status });

  const admin = createAdminClient();
  const folder = asset.storage_path.split("/").slice(0, -1).join("/");
  const name = asset.storage_path.split("/").pop()!;
  const { data: listed } = await admin.storage.from(STORAGE_BUCKET).list(folder, { search: name, limit: 1 });
  if (!listed?.some((o) => o.name === name)) throw new ApiError(409, "File belum selesai diunggah.", "upload_incomplete");

  await admin.from("media_assets").update({ status: "processing" }).eq("id", id).eq("user_id", userId);
  // The first video uploaded into a project becomes its source (used by auto-clip and the editor).
  if (asset.project_id && asset.storage_path.match(/\.(mp4|mov|webm|mkv|mp3|m4a|wav|aac|ogg)$/)) {
    await supabase.from("projects").update({ source_asset_id: id }).eq("id", asset.project_id).is("source_asset_id", null);
  }
  const job = await createAiJob({ supabase, userId, type: "probe", projectId: asset.project_id, input: { assetId: id } });
  return json({ assetId: id, status: "processing", jobId: job.id });
});
