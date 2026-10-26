import { getSpeechProviders, type Voice } from "@clipkarya/core/providers";
import { json, withAuth } from "@/lib/api";

let cache: { at: number; voices: (Voice & { isDemo: boolean })[]; errors: string[] } | null = null;

/** Voice library populated from the configured providers' real catalogs (cached 10 minutes). */
export const GET = withAuth(async () => {
  if (cache && Date.now() - cache.at < 10 * 60_000) return json(cache);
  const voices: (Voice & { isDemo: boolean })[] = [];
  const errors: string[] = [];
  for (const p of getSpeechProviders()) {
    try {
      voices.push(...(await p.listVoices()).map((v) => ({ ...v, isDemo: p.isDemo })));
    } catch {
      errors.push(`Gagal memuat suara dari ${p.id}.`);
    }
  }
  cache = { at: Date.now(), voices, errors };
  return json(cache);
});
