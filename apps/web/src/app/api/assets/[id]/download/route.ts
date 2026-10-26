import { NextResponse } from "next/server";
import { ApiError, uuidParam, withAuth } from "@/lib/api";
import { signDownload } from "@/lib/media";

/** Redirect to a short-lived signed download URL for an asset the caller owns. */
export const GET = withAuth<{ params: Promise<{ id: string }> }>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data } = await supabase
    .from("media_assets")
    .select("storage_path, original_name, status")
    .eq("id", id)
    .maybeSingle<{ storage_path: string; original_name: string | null; status: string }>();
  if (!data || data.status !== "ready") throw new ApiError(404, "File tidak tersedia.", "not_found");
  const filename = (data.original_name ?? data.storage_path.split("/").pop() ?? "download").replace(/[\\/"]/g, "");
  const url = await signDownload(data.storage_path, filename);
  if (!url) throw new ApiError(404, "File tidak tersedia.", "not_found");
  return NextResponse.redirect(url, 302);
});
