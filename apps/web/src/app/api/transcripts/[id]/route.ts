import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const { data } = await supabase.from("transcripts").select("id, asset_id, provider, language, text, segments, words, is_demo, edited, created_at").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "Transkrip tidak ditemukan.", "not_found");
  return json(data);
});

const patchBody = z.object({
  segments: z.array(z.object({ start: z.number().min(0), end: z.number().min(0), text: z.string().max(5000), speaker: z.string().nullable().optional() })).max(20000),
});

/** Save edited segment text. Word timings for edited segments are dropped (they no longer match). */
export const PATCH = withAuth<Params>(async ({ req, ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const b = await parseBody(req, patchBody);
  const { data: cur } = await supabase.from("transcripts").select("segments, words").eq("id", id).maybeSingle<{ segments: { start: number; end: number; text: string }[]; words: { start: number; end: number; text: string }[] }>();
  if (!cur) throw new ApiError(404, "Transkrip tidak ditemukan.", "not_found");
  const changed = b.segments.filter((s, i) => cur.segments[i]?.text !== s.text);
  const words = cur.words.filter((w) => !changed.some((s) => w.start >= s.start && w.end <= s.end + 0.01));
  const { error } = await supabase
    .from("transcripts")
    .update({ segments: b.segments, words, text: b.segments.map((s) => s.text).join(" "), edited: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
