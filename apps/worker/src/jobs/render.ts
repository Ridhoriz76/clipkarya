import path from "node:path";
import { writeFile } from "node:fs/promises";
import {
  assetIdsInTimeline,
  buildAss,
  captionItemsToCues,
  renderSettingsSchema,
  STORAGE_BUCKET,
  timelineSchema,
  toSRT,
  UserFacingError,
  validateTimeline,
  type CaptionItem,
  type TextItem,
} from "@clipkarya/core";
import { buildRenderPlan, parseProgress, type RenderAsset } from "@clipkarya/core/render";
import { createAssetFromFile, type AssetRow } from "../assets";
import { env } from "../env";
import { run, thumbnail } from "../ffmpeg";
import { downloadObject, jobTmpDir, uploadFile } from "../storage";
import { db, must } from "../supabase";
import type { JobContext } from "../runner";
import type { RenderJobRow } from "./types";

/** Files above this size are read over a signed URL (ffmpeg seeks via HTTP range) instead of downloaded. */
const STREAM_THRESHOLD_BYTES = 300 * 1024 * 1024;

export async function renderJob(ctx: JobContext<RenderJobRow>) {
  const timeline = timelineSchema.parse(ctx.job.timeline_snapshot);
  const settings = renderSettingsSchema.parse(ctx.job.settings);
  const issues = validateTimeline(timeline);
  if (issues.length) throw new UserFacingError(`Timeline tidak valid: ${issues[0]!.message}`, "invalid_timeline");
  const visible = timeline.items.filter((i) => i.type !== "caption");
  if (!visible.length) throw new UserFacingError("Timeline kosong. Tambahkan klip sebelum ekspor.", "empty_timeline");

  const dir = await jobTmpDir(ctx.job.id);
  const ids = assetIdsInTimeline(timeline);
  const { data: rows, error } = await db().from("media_assets").select("*").in("id", ids).eq("user_id", ctx.job.user_id);
  if (error) throw new Error(error.message);
  const byId = new Map((rows as AssetRow[]).map((r) => [r.id, r]));

  await ctx.progress(0.02, "fetching_media");
  const assets: Record<string, RenderAsset> = {};
  for (const [i, id] of ids.entries()) {
    const row = byId.get(id);
    if (!row || row.status !== "ready") throw new UserFacingError("Ada media di timeline yang tidak tersedia atau belum siap.", "asset_missing");
    let p: string;
    if ((row.size_bytes ?? 0) > STREAM_THRESHOLD_BYTES) {
      const { data } = await db().storage.from(STORAGE_BUCKET).createSignedUrl(row.storage_path, 6 * 3600);
      if (!data) throw new Error("signed url failed");
      p = data.signedUrl;
    } else {
      p = path.join(dir, `in_${i}${path.extname(row.storage_path)}`);
      await downloadObject(row.storage_path, p);
    }
    assets[id] = {
      path: p,
      kind: row.kind === "image" || row.kind === "thumbnail" ? "image" : row.kind === "audio" ? "audio" : "video",
      hasAudio: row.has_audio ?? row.kind === "audio",
      duration: row.duration_sec,
    };
    await ctx.progress(0.02 + (0.08 * (i + 1)) / ids.length, "fetching_media");
  }
  await ctx.ensureNotCanceled();

  const captions = timeline.items.filter((i): i is CaptionItem => i.type === "caption");
  const texts = timeline.items.filter((i): i is TextItem => i.type === "text");
  const subtitleTrackHidden = new Set(timeline.tracks.filter((t) => t.hidden).map((t) => t.id));
  const liveCaptions = captions.filter((c) => !subtitleTrackHidden.has(c.trackId));
  const liveTexts = texts.filter((t) => !subtitleTrackHidden.has(t.trackId));
  const burn = settings.burnCaptions && liveCaptions.length > 0;
  let assPath: string | null = null;
  const plan0 = buildRenderPlan({ timeline, assets, settings, assPath: null, outputPath: "/dev/null" });
  if (burn || liveTexts.length) {
    assPath = path.join(dir, "overlay.ass");
    await writeFile(
      assPath,
      buildAss({ width: plan0.width, height: plan0.height, captions: liveCaptions, texts: liveTexts, style: timeline.captionStyle, captionsEnabled: burn }),
    );
  }
  const output = path.join(dir, "export.mp4");
  const plan = buildRenderPlan({ timeline, assets, settings, assPath, outputPath: output, fontsDir: env().FONTS_DIR, preset: env().FFMPEG_PRESET });

  await ctx.progress(0.1, "rendering");
  let buffer = "";
  await run(env().FFMPEG_PATH, plan.args, {
    timeoutMs: env().RENDER_TIMEOUT_SEC * 1000,
    signal: ctx.signal,
    onStdout: (chunk) => {
      buffer = (buffer + chunk).slice(-4000);
      const f = parseProgress(buffer, plan.duration);
      if (f !== null) void ctx.progress(0.1 + f * 0.8, "rendering");
    },
  });
  await ctx.ensureNotCanceled();

  await ctx.progress(0.92, "uploading");
  const { data: project } = await db().from("projects").select("title").eq("id", ctx.job.project_id).single<{ title: string }>();
  const baseName = (project?.title ?? "export").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "export";
  const exportAsset = await createAssetFromFile({
    userId: ctx.job.user_id,
    projectId: ctx.job.project_id,
    kind: "export",
    source: "render",
    file: output,
    mime: "video/mp4",
    ext: "mp4",
    name: `${baseName} · ${settings.resolution}.mp4`,
    metadata: { renderJobId: ctx.job.id, settings },
    withProbe: true,
  });
  // Sanity check: never mark an export complete if the output doesn't match the requested frame.
  if (exportAsset.width !== plan.width || exportAsset.height !== plan.height) {
    throw new Error(`output size mismatch ${exportAsset.width}x${exportAsset.height} != ${plan.width}x${plan.height}`);
  }
  const thumbLocal = path.join(dir, "thumb.jpg");
  await thumbnail(output, thumbLocal, Math.min(1, plan.duration / 3)).catch(() => undefined);
  const thumbKey = exportAsset.storage_path.replace(/\.mp4$/, ".thumb.jpg");
  const thumbOk = await uploadFile(thumbKey, thumbLocal, "image/jpeg").then(() => true).catch(() => false);
  if (thumbOk) await db().from("media_assets").update({ thumbnail_path: thumbKey }).eq("id", exportAsset.id);

  let srtAssetId: string | null = null;
  if (settings.exportSrt && liveCaptions.length) {
    const srt = toSRT(captionItemsToCues(liveCaptions));
    const srtAsset = await createAssetFromFile({
      userId: ctx.job.user_id,
      projectId: ctx.job.project_id,
      kind: "subtitle",
      source: "render",
      bytes: new TextEncoder().encode(srt),
      mime: "application/x-subrip",
      ext: "srt",
      name: `${baseName}.srt`,
    });
    srtAssetId = srtAsset.id;
  }
  must(await db().from("projects").update({ status: "ready" }).eq("id", ctx.job.project_id).select("id"), "project status");
  await ctx.logUsage({ provider: "ffmpeg", operation: "render", units: plan.duration, unitType: "seconds", estimatedCostUsd: null }, ctx.job.credits_cost);
  return { patch: { output_asset_id: exportAsset.id, srt_asset_id: srtAssetId, duration_sec: plan.duration } };
}
