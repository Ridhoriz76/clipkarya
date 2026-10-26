import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccountSummary = {
  credits: number;
  plan: { id: string; name: string; monthly_credits: number; max_export_resolution: string } | null;
  periodEnd: string | null;
};

export const getAccountSummary = cache(async (): Promise<AccountSummary> => {
  const supabase = await createClient();
  const [{ data: credits }, { data: sub }] = await Promise.all([
    supabase.rpc("my_credit_balance"),
    supabase
      .from("user_subscriptions")
      .select("current_period_end, plan:subscription_plans(id, name, monthly_credits, max_export_resolution)")
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle<{ current_period_end: string; plan: AccountSummary["plan"] }>(),
  ]);
  return { credits: (credits as number | null) ?? 0, plan: sub?.plan ?? null, periodEnd: sub?.current_period_end ?? null };
});
