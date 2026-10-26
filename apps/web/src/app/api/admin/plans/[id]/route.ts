import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const body = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(300),
  price_cents: z.number().int().min(0),
  monthly_credits: z.number().int().min(0).max(1_000_000),
  max_upload_mb: z.number().int().min(10).max(2048),
  max_export_resolution: z.enum(["720p", "1080p"]),
  is_active: z.boolean(),
  features: z.array(z.string().max(100)).max(12),
});

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, userId, supabase }) => {
  await assertAdmin(supabase, userId);
  const id = z.string().regex(/^[a-z0-9_-]{1,40}$/).parse((await ctx.params).id);
  const b = await parseBody(req, body);
  const { error } = await createAdminClient().from("subscription_plans").upsert({ id, ...b });
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
