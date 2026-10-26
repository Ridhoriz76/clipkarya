import path from "node:path";
import { jobInputSchemas, UPLOAD_LIMITS, UserFacingError } from "@clipkarya/core";
import { getAsset } from "../assets";
import { probe, thumbnail } from "../ffmpeg";
import { downloadObject, jobTmpDir, uploadFile } from "../storage";
import { db } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

/** Validate an uploaded file with FFprobe, store technical metadata and a thumbnail. */
export async function probeJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.probe.parse(ctx.job.input);
  const asset = await getAsset(input.assetId, ctx.job.user_id);
  const dir = await jobTmpDir(ctx.job.id);
  const local = path.join(dir, `src${path.extname(asset.storage_path)}`);
  await ctx.progress(0.1, "download");
  try {
    await downloadObject(asset.storage_path, local);
  } catch {
    await db().from("media_assets").update({ status: "failed", metadata: { error: "upload_missing" } }).eq("id", asset.id);
    throw new UserFacingError("File unggahan tidak ditemukan. Silakan unggah ulang.", "upload_missing");
  }
  await ctx.progress(0.5, "probe");
  let meta;
  try {
    meta = await probe(local);
  } catch {
    await db().from("media_assets").update({ status: "failed", metadata: { error: "unreadable" } }).eq("id", asset.id);
    throw new UserFacingError("File media tidak dapat dibaca. Pastikan formatnya MP4, MOV, WEBM, MP3, WAV, PNG atau JPG.", "invalid_media");
  }
  if (asset.kind === "video" && !meta.hasVideo) {
    await db().from("media_assets").update({ status: "failed" }).eq("id", asset.id);
    throw new UserFacingError("File tidak berisi stream video.", "invalid_media");
  }
  if (meta.durationSec && meta.durationSec > UPLOAD_LIMITS.maxDurationSec) {
    await db().from("media_assets").update({ status: "failed" }).eq("id", asset.id);
    throw new UserFacingError("Durasi media melebihi batas 3 jam.", "too_long");
  }

  let thumbPath: string | null = null;
  if (asset.kind === "video" || asset.kind === "image") {
    const thumbLocal = path.join(dir, "thumb.jpg");
    await thumbnail(local, thumbLocal, asset.kind === "video" ? Math.min(1, (meta.durationSec ?? 0) / 3) : 0);
    thumbPath = asset.storage_path.replace(/\.[^.]+$/, "") + ".thumb.jpg";
    await uploadFile(thumbPath, thumbLocal, "image/jpeg");
  }
  await db()
    .from("media_assets")
    .update({
      status: "ready",
      duration_sec: meta.durationSec,
      width: meta.width,
      height: meta.height,
      has_audio: meta.hasAudio,
      thumbnail_path: thumbPath,
      metadata: { probe: meta },
    })
    .eq("id", asset.id);
  if (asset.project_id && thumbPath) {
    await db().from("projects").update({ thumbnail_asset_id: asset.id }).eq("id", asset.project_id).is("thumbnail_asset_id", null);
  }
  return { output: { assetId: asset.id, ...meta } };
}
