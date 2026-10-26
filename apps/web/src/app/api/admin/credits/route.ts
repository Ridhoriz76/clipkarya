import { z } from "zod";
import { ApiError, json, parseBody, withAuth } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const body = z.object({
  email: z.email(),
  amount: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0),
  reason: z.string().trim().min(3).max(200),
});

/** Manual credit adjustment by an administrator (audited in credit_transactions). */
export const POST = withAuth(async ({ req, userId, supabase }) => {
  await assertAdmin(supabase, userId);
  const b = await parseBody(req, body);
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id").eq("email", b.email).maybeSingle<{ id: string }>();
  if (!target) throw new ApiError(404, "Pengguna tidak ditemukan.", "not_found");
  const { data, error } = await admin.rpc("grant_credits", { p_user: target.id, p_amount: b.amount, p_reason: `${b.reason} (oleh admin)`, p_kind: "adjustment" });
  if (error) throw new Error(error.message);
  return json({ balance: data });
});
