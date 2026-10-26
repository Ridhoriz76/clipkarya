import { toSRT, toVTT, wordsToCues } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, uuidParam, withAuth } from "@/lib/api";

/** Download a transcript as SRT or VTT. Uses word timings when available for short, readable cues. */
export const GET = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const sp = new URL(req.url).searchParams;
  const format = z.enum(["srt", "vtt"]).parse(sp.get("format") ?? "srt");
  const mode = z.enum(["segments", "short"]).parse(sp.get("mode") ?? "segments");
  const { data } = await supabase
    .from("transcripts")
    .select("segments, words, created_at")
    .eq("id", id)
    .maybeSingle<{ segments: { start: number; end: number; text: string }[]; words: { start: number; end: number; text: string }[] }>();
  if (!data) throw new ApiError(404, "Transkrip tidak ditemukan.", "not_found");
  const cues = mode === "short" && data.words.length ? wordsToCues(data.words, 6) : data.segments;
  const body = format === "srt" ? toSRT(cues) : toVTT(cues);
  return new Response(body, {
    headers: {
      "Content-Type": format === "srt" ? "application/x-subrip; charset=utf-8" : "text/vtt; charset=utf-8",
      "Content-Disposition": `attachment; filename="transkrip-${id.slice(0, 8)}.${format}"`,
    },
  });
});
