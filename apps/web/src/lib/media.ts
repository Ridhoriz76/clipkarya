import "server-only";
import { STORAGE_BUCKET } from "@clipkarya/core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Batch-sign storage paths. Callers must only pass paths read through the user's
 * RLS client (i.e. rows the user owns).
 */
export async function signPaths(paths: (string | null | undefined)[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!unique.length) return {};
  const { data } = await createAdminClient().storage.from(STORAGE_BUCKET).createSignedUrls(unique, expiresIn);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function signDownload(path: string, filename: string, expiresIn = 600): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn, { download: filename });
  return data?.signedUrl ?? null;
}
