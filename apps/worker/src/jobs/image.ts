import { jobInputSchemas } from "@clipkarya/core";
import { getImageProvider } from "@clipkarya/core/providers";
import { createAssetFromFile } from "../assets";
import { db } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

export async function imageJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.image.parse(ctx.job.input);
  const provider = getImageProvider();
  await ctx.progress(0.1, "generating");
  const { images, usage } = await provider.generate(input);
  await ctx.logUsage(usage, ctx.job.credits_cost, false);
  const assetIds: string[] = [];
  for (const [i, img] of images.entries()) {
    await ctx.progress(0.7 + (0.3 * i) / images.length, "saving");
    const a = await createAssetFromFile({
      userId: ctx.job.user_id,
      projectId: ctx.job.project_id,
      kind: "image",
      source: "image_gen",
      bytes: img.data,
      mime: img.mimeType,
      ext: img.ext,
      name: `AI · ${input.prompt.slice(0, 50)}`,
      metadata: { prompt: input.prompt, provider: provider.id, aspectRatio: input.aspectRatio },
    });
    assetIds.push(a.id);
  }
  if (input.sceneId && assetIds[0]) {
    await db().from("project_scenes").update({ image_asset_id: assetIds[0] }).eq("id", input.sceneId).eq("user_id", ctx.job.user_id);
  }
  return { output: { assetIds, sceneId: input.sceneId ?? null }, patch: { provider: provider.id } };
}
