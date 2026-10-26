import "server-only";
import { ApiError } from "@/lib/api";
import type { createClient } from "@/lib/supabase/server";

/** Server-side admin authorization for API routes (role stored in profiles, not user-editable). */
export async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<void> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single<{ role: string }>();
  if (data?.role !== "admin") throw new ApiError(403, "Hanya admin.", "forbidden");
}
