import { z } from "zod";
import { json, withAuth } from "@/lib/api";

/** Latest transcript per asset, for building captions in the editor. */
export const GET = withAuth(async ({ req, supabase }) => {
  const ids = (new URL(req.url).searchParams.get("assetIds") ?? "").split(",").filter((s) => z.uuid().safeParse(s).success).slice(0, 50);
  if (!ids.length) return json({ transcripts: [] });
  const { data, error } = await supabase
    .from("transcripts")
    .select("id, asset_id, language, segments, words, is_demo, created_at")
    .in("asset_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const t of data ?? []) if (!latest.has(t.asset_id)) latest.set(t.asset_id, t);
  return json({ transcripts: [...latest.values()] });
});
