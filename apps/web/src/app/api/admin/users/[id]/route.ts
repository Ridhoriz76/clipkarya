import { z } from "zod";
import { ApiError, json, parseBody, uuidParam, withAuth } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const body = z.object({ planId: z.string().regex(/^[a-z0-9_-]{1,40}$/) });

/** Change a user's plan (stand-in for a payment provider webhook during the MVP). */
export const PUT = withAuth<{ params: Promise<{ id: string }> }>(async ({ req, ctx, userId, supabase }) => {
  await assertAdmin(supabase, userId);
  const target = uuidParam.parse((await ctx.params).id);
  const { planId } = await parseBody(req, body);
  const admin = createAdminClient();
  const { data: plan } = await admin.from("subscription_plans").select("id, monthly_credits, name").eq("id", planId).maybeSingle<{ id: string; monthly_credits: number; name: string }>();
  if (!plan) throw new ApiError(404, "Paket tidak ditemukan.", "not_found");
  await admin.from("user_subscriptions").update({ status: "canceled" }).eq("user_id", target).in("status", ["active", "trialing", "past_due"]);
  const { error } = await admin.from("user_subscriptions").insert({ user_id: target, plan_id: plan.id, status: "active" });
  if (error) throw new Error(error.message);
  await admin.rpc("grant_credits", { p_user: target, p_amount: plan.monthly_credits, p_reason: `Kredit paket ${plan.name}` });
  return json({ ok: true });
});
