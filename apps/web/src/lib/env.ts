import { getAppName } from "@clipkarya/core";

export const APP_NAME = getAppName({ NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME });

export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    appUrl: process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}

/** True when the minimum backend configuration exists. Pages show a setup notice otherwise. */
export function isSupabaseConfigured(): boolean {
  const e = publicEnv();
  return Boolean(e.supabaseUrl && e.supabaseAnonKey);
}

/**
 * Free mode (default on): hides prices, plans and credits everywhere. Read with a literal
 * `process.env.NEXT_PUBLIC_…` so Next inlines it for client components too. Server-side
 * enforcement uses isFreeMode() from @clipkarya/core with the same variable.
 */
export const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE?.trim().toLowerCase() !== "false";

/** " · N kredit" for cost hints, or "" in free mode. */
export function creditHint(n: number): string {
  return FREE_MODE ? "" : ` · ${n} kredit`;
}
