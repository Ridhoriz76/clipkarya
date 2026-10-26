import { timelineSchema, validateTimeline } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data, error } = await supabase.rpc("get_timeline", { p_project: id });
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  return json(data);
});

const putBody = z.object({ expectedVersion: z.number().int().min(0), timeline: timelineSchema });

/** Persist the editor document. Validated server-side; optimistic concurrency via timeline_version. */
export const PUT = withAuth<Params>(async ({ req, ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, putBody);
  const issues = validateTimeline(b.timeline);
  if (issues.length) throw new ApiError(422, issues[0]!.message, "invalid_timeline", { issues });
  const { data, error } = await supabase.rpc("save_timeline", { p_project: id, p_expected_version: b.expectedVersion, p_doc: b.timeline });
  if (error) {
    if (error.message.includes("version_conflict")) throw new ApiError(409, "Proyek diubah di tab/perangkat lain. Muat ulang untuk melanjutkan.", "version_conflict");
    if (error.message.includes("asset_forbidden")) throw new ApiError(403, "Timeline mereferensikan media yang tidak Anda miliki.", "asset_forbidden");
    if (error.message.includes("not_found")) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
    throw new Error(error.message);
  }
  return json({ version: data as number });
});
