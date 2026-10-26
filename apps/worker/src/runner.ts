import { safeErrorMessage, UserFacingError } from "@clipkarya/core";
import { ProviderError, type ProviderUsage } from "@clipkarya/core/providers";
import { db } from "./supabase";
import { cleanupTmp } from "./storage";

export type JobTable = "ai_generation_jobs" | "render_jobs";

export class JobCanceledError extends Error {
  constructor() {
    super("canceled");
  }
}

export type JobContext<Row> = {
  job: Row;
  progress: (fraction: number, stage?: string) => Promise<void>;
  ensureNotCanceled: () => Promise<void>;
  logUsage: (usage: ProviderUsage, credits?: number, isDemo?: boolean) => Promise<void>;
  signal: AbortSignal;
};

type BaseRow = { id: string; user_id: string; status: string; credits_cost: number; attempts: number };

/**
 * Shared lifecycle for every job:
 * queued → processing → completed | failed | canceled.
 * Failed and canceled jobs get their reserved credits refunded exactly once.
 * Errors stored on the row are always user-safe; details go to the worker log only.
 */
export async function runJob<Row extends BaseRow, Out extends Record<string, unknown> | null>(
  table: JobTable,
  jobId: string,
  handler: (ctx: JobContext<Row>) => Promise<{ output?: Out; patch?: Record<string, unknown> }>,
  opts: { isFinalAttempt: boolean },
): Promise<void> {
  const { data: job, error } = await db().from(table).select("*").eq("id", jobId).single<Row>();
  if (error || !job) throw new Error(`job ${jobId} not found: ${error?.message}`);
  if (job.status === "completed" || job.status === "canceled") return; // idempotent re-delivery

  const abort = new AbortController();
  let lastWrite = 0;
  const ctx: JobContext<Row> = {
    job,
    signal: abort.signal,
    async progress(fraction, stage) {
      const now = Date.now();
      if (now - lastWrite < 1000 && fraction < 1) return; // throttle DB writes
      lastWrite = now;
      await db().from(table).update({ progress: Math.max(0, Math.min(1, fraction)), ...(stage ? { stage } : {}) }).eq("id", jobId);
    },
    async ensureNotCanceled() {
      const { data } = await db().from(table).select("status").eq("id", jobId).single<{ status: string }>();
      if (data?.status === "canceled") {
        abort.abort();
        throw new JobCanceledError();
      }
    },
    async logUsage(usage, credits = 0, isDemo = false) {
      await db().from("usage_logs").insert({
        user_id: job.user_id,
        job_id: jobId,
        job_table: table,
        provider: usage.provider,
        operation: usage.operation,
        model: usage.model ?? null,
        units: usage.units,
        unit_type: usage.unitType,
        estimated_cost_usd: usage.estimatedCostUsd,
        credits,
        is_demo: isDemo,
      });
    },
  };

  // Watch for cancellation while long steps run.
  const poll = setInterval(() => {
    ctx.ensureNotCanceled().catch(() => undefined);
  }, 3000);

  try {
    await db()
      .from(table)
      .update({ status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1, error_message: null })
      .eq("id", jobId)
      .neq("status", "canceled");
    await ctx.ensureNotCanceled();
    const result = await handler(ctx);
    if (abort.signal.aborted) throw new JobCanceledError();
    await db()
      .from(table)
      .update({
        status: "completed",
        progress: 1,
        stage: "done",
        completed_at: new Date().toISOString(),
        ...(result.output !== undefined ? { output: result.output } : {}),
        ...(result.patch ?? {}),
      })
      .eq("id", jobId);
  } catch (err) {
    if (err instanceof JobCanceledError || abort.signal.aborted) {
      await db().rpc("refund_job_credits", { p_job_id: jobId, p_job_table: table, p_reason: "Pengembalian kredit: job dibatalkan" });
      console.info(`[job ${jobId}] canceled`);
      return;
    }
    const userErr = err instanceof ProviderError ? err.toUserFacing() : err;
    const retryable = (userErr instanceof UserFacingError && userErr.retryable) || !(userErr instanceof UserFacingError);
    console.error(`[job ${jobId}] failed`, err);
    if (retryable && !opts.isFinalAttempt) {
      await db().from(table).update({ status: "queued", stage: "retrying" }).eq("id", jobId);
      throw err; // let BullMQ retry with backoff
    }
    await db()
      .from(table)
      .update({
        status: "failed",
        error_message: safeErrorMessage(userErr),
        ...(table === "ai_generation_jobs" ? { error_code: userErr instanceof UserFacingError ? userErr.code : "internal" } : {}),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    await db().rpc("refund_job_credits", { p_job_id: jobId, p_job_table: table, p_reason: "Pengembalian kredit: job gagal" });
  } finally {
    clearInterval(poll);
    await cleanupTmp(jobId).catch(() => undefined);
  }
}
