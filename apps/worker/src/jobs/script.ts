import { jobInputSchemas, scriptResultSchema, scriptSystemPrompt, scriptUserPrompt } from "@clipkarya/core";
import { getTextProvider } from "@clipkarya/core/providers";
import { db } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

export async function scriptJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.script.parse(ctx.job.input);
  const llm = getTextProvider();
  await ctx.progress(0.1, "writing");
  const { data, usage } = await llm.generateJson({
    system: scriptSystemPrompt(),
    prompt: scriptUserPrompt(input),
    schema: scriptResultSchema,
    maxTokens: 4000,
  });
  await ctx.logUsage(usage, ctx.job.credits_cost, false);
  if (ctx.job.project_id) {
    await db().from("project_scenes").delete().eq("project_id", ctx.job.project_id).eq("user_id", ctx.job.user_id);
    await db()
      .from("project_scenes")
      .insert(
        data.scenes.map((s, i) => ({
          project_id: ctx.job.project_id,
          user_id: ctx.job.user_id,
          position: i,
          title: s.title,
          narration: s.narration,
          visual_description: s.visual,
          on_screen_text: s.onScreenText,
          duration_sec: s.durationSec,
          needs_verification: s.needsVerification,
        })),
      );
    await db().from("projects").update({ title: data.title.slice(0, 200), settings: { script: { hook: data.hook, ending: data.ending, hashtags: data.hashtags } } }).eq("id", ctx.job.project_id);
  }
  return { output: data, patch: { provider: llm.id } };
}
