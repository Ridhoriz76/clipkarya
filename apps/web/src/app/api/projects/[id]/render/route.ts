import { json, parseBody, uuidParam, withAuth } from "@/lib/api";
import { createRenderJob } from "@/lib/jobs";
import { renderSettingsSchema } from "@clipkarya/core";

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, userId, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const settings = await parseBody(req, renderSettingsSchema);
  const job = await createRenderJob({ supabase, userId, projectId: id, settings });
  return json(job, 202);
});
