import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";

export type Plan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  interval: string;
  monthly_credits: number;
  max_export_resolution: string;
  features: string[];
  is_default: boolean;
};

/** Mirrors supabase/seed.sql; used only when the database isn't reachable (e.g. first local run). */
const FALLBACK_PLANS: Plan[] = [
  { id: "free", name: "Gratis", description: "Coba semua alur kerja inti.", price_cents: 0, currency: "IDR", interval: "month", monthly_credits: 30, max_export_resolution: "720p", features: ["30 kredit/bulan", "Ekspor 720p", "Auto-clip & subtitle", "Voiceover AI"], is_default: true },
  { id: "creator", name: "Kreator", description: "Untuk kreator yang rutin posting.", price_cents: 9900000, currency: "IDR", interval: "month", monthly_credits: 300, max_export_resolution: "1080p", features: ["300 kredit/bulan", "Ekspor 1080p", "Upload hingga 2 GB", "Brand kit"], is_default: false },
  { id: "pro", name: "Pro", description: "Untuk tim dan agensi.", price_cents: 29900000, currency: "IDR", interval: "month", monthly_credits: 1200, max_export_resolution: "1080p", features: ["1.200 kredit/bulan", "Ekspor 1080p", "Prioritas antrean render", "Semua fitur AI"], is_default: false },
];

export async function getPlans(): Promise<Plan[]> {
  if (!isSupabaseConfigured()) return FALLBACK_PLANS;
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("subscription_plans")
      .select("id, name, description, price_cents, currency, interval, monthly_credits, max_export_resolution, features, is_default")
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return FALLBACK_PLANS;
    return data as Plan[];
  } catch {
    return FALLBACK_PLANS;
  }
}
