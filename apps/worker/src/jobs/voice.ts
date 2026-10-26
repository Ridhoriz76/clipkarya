import path from "node:path";
import { writeFile } from "node:fs/promises";
import { jobInputSchemas } from "@clipkarya/core";
import { getSpeechProvider } from "@clipkarya/core/providers";
import { createAssetFromFile } from "../assets";
import { jobTmpDir } from "../storage";
import { db } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

export async function voiceJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.voice.parse(ctx.job.input);
  const provider = getSpeechProvider(input.provider);
  await ctx.progress(0.1, "synthesizing");
  const { audio, mimeType, ext, usage } = await provider.synthesize({
    text: input.text,
    voiceId: input.voiceId,
    speed: input.speed,
    language: input.language,
  });
  await ctx.logUsage(usage, ctx.job.credits_cost, provider.isDemo);
  await ctx.ensureNotCanceled();
  const dir = await jobTmpDir(ctx.job.id);
  const file = path.join(dir, `voice.${ext}`);
  await writeFile(file, audio);
  await ctx.progress(0.7, "saving");
  const asset = await createAssetFromFile({
    userId: ctx.job.user_id,
    projectId: ctx.job.project_id,
    kind: "audio",
    source: "tts",
    file,
    mime: mimeType,
    ext,
    name: `${provider.isDemo ? "[DEMO] " : ""}Voiceover · ${input.text.slice(0, 40)}`,
    isDemo: provider.isDemo,
    metadata: { provider: provider.id, voiceId: input.voiceId, text: input.text },
    withProbe: true,
  });
  if (input.sceneId) {
    await db().from("project_scenes").update({ voice_asset_id: asset.id }).eq("id", input.sceneId).eq("user_id", ctx.job.user_id);
  }
  return {
    output: { assetId: asset.id, durationSec: asset.duration_sec, placeAt: input.placeAt ?? null, sceneId: input.sceneId ?? null, isDemo: provider.isDemo },
    patch: { provider: provider.id, is_demo: provider.isDemo },
  };
}
