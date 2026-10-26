import path from "node:path";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { jobInputSchemas, UserFacingError } from "@clipkarya/core";
import { getVideoProvider } from "@clipkarya/core/providers";
import { createAssetFromFile } from "../assets";
import { jobTmpDir } from "../storage";
import { db } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

const POLL_MS = 5000;
const MAX_WAIT_MS = 20 * 60_000;

export async function videoJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.video.parse(ctx.job.input);
  const provider = getVideoProvider();
  let requestId = ctx.job.provider_request_id;
  if (!requestId) {
    const prompt = input.style ? `${input.prompt}. Style: ${input.style}` : input.prompt;
    const sub = await provider.submit({ ...input, prompt });
    requestId = sub.requestId;
    // Persist so a retry resumes polling instead of paying for a second generation.
    await db().from("ai_generation_jobs").update({ provider_request_id: requestId, provider: provider.id }).eq("id", ctx.job.id);
    await ctx.logUsage(sub.usage, ctx.job.credits_cost, false);
  }
  const started = Date.now();
  let fake = 0.1;
  for (;;) {
    await ctx.ensureNotCanceled();
    const st = await provider.poll(requestId);
    if (st.state === "failed") throw new UserFacingError(`Penyedia video gagal: ${st.error.slice(0, 200)}`, "provider_failed");
    if (st.state === "completed") {
      await ctx.progress(0.9, "downloading");
      const dir = await jobTmpDir(ctx.job.id);
      const file = path.join(dir, "generated.mp4");
      const res = await fetch(st.videoUrl);
      if (!res.ok || !res.body) throw new UserFacingError("Gagal mengunduh hasil video dari penyedia.", "provider_failed", true);
      await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(file));
      const asset = await createAssetFromFile({
        userId: ctx.job.user_id,
        projectId: ctx.job.project_id,
        kind: "video",
        source: "video_gen",
        file,
        mime: "video/mp4",
        ext: "mp4",
        name: `AI Video · ${input.prompt.slice(0, 40)}`,
        metadata: { prompt: input.prompt, provider: provider.id },
        withProbe: true,
      });
      return { output: { assetId: asset.id } };
    }
    // Report real queue state; progress is only an elapsed-time indicator while the provider works.
    fake = Math.min(0.85, fake + 0.03);
    await ctx.progress(st.state === "queued" ? 0.1 : fake, st.state === "queued" ? `queue:${st.queuePosition ?? "?"}` : "generating");
    if (Date.now() - started > MAX_WAIT_MS) throw new UserFacingError("Pembuatan video melebihi batas waktu.", "timeout");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
