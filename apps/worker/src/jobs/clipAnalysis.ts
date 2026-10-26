import path from "node:path";
import {
  applyRelevance,
  findClipCandidates,
  jobInputSchemas,
  relevancePrompt,
  relevanceSchema,
  STORAGE_BUCKET,
  type Transcript,
} from "@clipkarya/core";
import { getTextProvider } from "@clipkarya/core/providers";
import { getAsset } from "../assets";
import { thumbnail } from "../ffmpeg";
import { jobTmpDir, uploadFile } from "../storage";
import { db, must } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

type TranscriptRow = Transcript & { id: string; asset_id: string; project_id: string | null; is_demo: boolean };

export async function clipAnalysisJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.clip_analysis.parse(ctx.job.input);
  const t = must(
    await db()
      .from("transcripts")
      .select("id, asset_id, project_id, language, text, segments, words, duration:duration_sec, is_demo")
      .eq("id", input.transcriptId)
      .eq("user_id", ctx.job.user_id)
      .single<TranscriptRow>(),
    "transcript",
  );
  const projectId = ctx.job.project_id ?? t.project_id;
  if (!projectId) throw new Error("clip analysis requires a project");
  const asset = await getAsset(t.asset_id, ctx.job.user_id);

  await ctx.progress(0.1, "scoring");
  const target = Math.round((input.minDuration + input.maxDuration) / 2);
  let candidates = findClipCandidates(t, {
    minDuration: input.minDuration,
    maxDuration: input.maxDuration,
    targetDuration: target,
    maxCandidates: input.maxCandidates,
  });

  // Optional semantic relevance when the user gave a focus and a text model is configured.
  let relevanceProvider: string | null = null;
  if (input.focus && candidates.length) {
    try {
      const llm = getTextProvider();
      const { data, usage } = await llm.generateJson({
        system: "You evaluate transcript excerpts for short-form video editors.",
        prompt: relevancePrompt(input.focus, candidates.map((c) => c.text)),
        schema: relevanceSchema,
        maxTokens: 800,
      });
      candidates = applyRelevance(candidates, data.scores);
      relevanceProvider = llm.id;
      await ctx.logUsage(usage, 0, false);
    } catch (err) {
      console.warn(`[job ${ctx.job.id}] relevance skipped:`, (err as Error).message);
    }
  }
  await ctx.ensureNotCanceled();

  // Thumbnails: seek directly over a signed URL instead of downloading the whole source.
  const { data: signed } = await db().storage.from(STORAGE_BUCKET).createSignedUrl(asset.storage_path, 3600);
  const dir = await jobTmpDir(ctx.job.id);
  await db().from("video_clips").delete().eq("project_id", projectId).eq("status", "suggested");

  const rows = [];
  for (const [i, c] of candidates.entries()) {
    await ctx.progress(0.2 + (0.75 * i) / Math.max(1, candidates.length), "thumbnails");
    let thumbAssetId: string | null = null;
    if (signed?.signedUrl && asset.kind === "video") {
      try {
        const local = path.join(dir, `clip${i}.jpg`);
        await thumbnail(signed.signedUrl, local, c.start + Math.min(2, c.duration / 2), 360);
        const key = `${ctx.job.user_id}/${projectId}/clips/${ctx.job.id}-${i}.jpg`;
        await uploadFile(key, local, "image/jpeg");
        const thumbAsset = must(
          await db()
            .from("media_assets")
            .insert({ user_id: ctx.job.user_id, project_id: projectId, kind: "thumbnail", source: "derived", status: "ready", storage_path: key, mime_type: "image/jpeg", thumbnail_path: key })
            .select("id")
            .single<{ id: string }>(),
          "thumb asset",
        );
        thumbAssetId = thumbAsset.id;
      } catch (err) {
        console.warn("thumbnail failed", (err as Error).message);
      }
    }
    rows.push({
      user_id: ctx.job.user_id,
      project_id: projectId,
      source_asset_id: asset.id,
      transcript_id: t.id,
      title: c.hookText.slice(0, 120),
      start_sec: c.start,
      end_sec: c.end,
      transcript_excerpt: c.text.slice(0, 4000),
      hook_text: c.hookText,
      score: c.score,
      score_breakdown: c.breakdown,
      reasons: c.reasons,
      thumbnail_asset_id: thumbAssetId,
    });
  }
  if (rows.length) must(await db().from("video_clips").insert(rows).select("id"), "insert clips");
  return { output: { candidates: rows.length, relevanceProvider, isDemo: t.is_demo } };
}
