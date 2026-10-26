import { CAPTION_FONTS, captionStyleSchema } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, json, parseBody, withAuth } from "@/lib/api";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const body = z.object({
  name: z.string().trim().min(1).max(100),
  colors: z.array(hex).min(1).max(8),
  fonts: z.object({ heading: z.enum(CAPTION_FONTS), body: z.enum(CAPTION_FONTS) }),
  caption_preset: captionStyleSchema.partial(),
  default_voice: z.object({ provider: z.string().max(40), voiceId: z.string().max(100), name: z.string().max(100) }).nullable(),
  logo_asset_id: z.uuid().nullable(),
  intro_asset_id: z.uuid().nullable(),
  outro_asset_id: z.uuid().nullable(),
});

export const PUT = withAuth(async ({ req, userId, supabase }) => {
  const b = await parseBody(req, body);
  const assetIds = [b.logo_asset_id, b.intro_asset_id, b.outro_asset_id].filter((x): x is string => Boolean(x));
  if (assetIds.length) {
    const { data } = await supabase.from("media_assets").select("id").in("id", assetIds);
    if ((data ?? []).length !== new Set(assetIds).size) throw new ApiError(403, "Media tidak valid.", "asset_forbidden");
  }
  const { data: existing } = await supabase.from("brand_kits").select("id").eq("is_default", true).maybeSingle<{ id: string }>();
  const res = existing
    ? await supabase.from("brand_kits").update(b).eq("id", existing.id)
    : await supabase.from("brand_kits").insert({ ...b, user_id: userId, is_default: true });
  if (res.error) throw new Error(res.error.message);
  return json({ ok: true });
});
