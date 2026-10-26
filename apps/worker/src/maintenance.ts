import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { db } from "./supabase";

const TMP_MAX_AGE_MS = 6 * 3600_000;
const STALE_JOB_MS = 2 * 3600_000;
const PENDING_UPLOAD_MAX_AGE_MS = 24 * 3600_000;

/** Remove abandoned per-job temp directories (e.g. after a crash). */
export async function cleanupTempDirs(): Promise<number> {
  const root = env().WORKER_TMP_DIR;
  let removed = 0;
  const entries = await readdir(root).catch(() => [] as string[]);
  for (const e of entries) {
    const p = path.join(root, e);
    const s = await stat(p).catch(() => null);
    if (s && Date.now() - s.mtimeMs > TMP_MAX_AGE_MS) {
      await rm(p, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

/** Fail jobs stuck in processing (worker crash) and refund their credits. */
export async function failStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_JOB_MS).toISOString();
  let n = 0;
  for (const table of ["ai_generation_jobs", "render_jobs"] as const) {
    const { data } = await db().from(table).select("id").eq("status", "processing").lt("updated_at", cutoff);
    for (const row of (data ?? []) as { id: string }[]) {
      await db()
        .from(table)
        .update({ status: "failed", error_message: "Proses terhenti tak terduga. Kredit telah dikembalikan.", completed_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "processing");
      await db().rpc("refund_job_credits", { p_job_id: row.id, p_job_table: table, p_reason: "Pengembalian kredit: job terhenti" });
      n++;
    }
  }
  return n;
}

/** Delete asset rows (and objects) for uploads that were never completed. */
export async function cleanupAbandonedUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_UPLOAD_MAX_AGE_MS).toISOString();
  const { data } = await db().from("media_assets").select("id, storage_path").eq("status", "pending_upload").lt("created_at", cutoff).limit(500);
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (!rows.length) return 0;
  await db().storage.from("media").remove(rows.map((r) => r.storage_path));
  await db().from("media_assets").delete().in("id", rows.map((r) => r.id));
  return rows.length;
}

export async function runMaintenance(): Promise<Record<string, number>> {
  const [tmp, stale, uploads] = await Promise.all([cleanupTempDirs(), failStaleJobs(), cleanupAbandonedUploads()]);
  const { data: renewed } = await db().rpc("renew_due_subscriptions");
  return { tmp, stale, uploads, renewed: Number(renewed ?? 0) };
}
