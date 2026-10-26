import { ApiError, json, uuidParam, withAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeQueued } from "@/lib/queue";

/** Cancel a queued or running job. The worker stops at its next checkpoint; credits are refunded. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async ({ ctx, supabase }) => {
  const id = uuidParam.parse((await ctx.params).id);
  const [ai, render] = await Promise.all([
    supabase.from("ai_generation_jobs").select("id, status").eq("id", id).maybeSingle<{ id: string; status: string }>(),
    supabase.from("render_jobs").select("id, status").eq("id", id).maybeSingle<{ id: string; status: string }>(),
  ]);
  const row = ai.data ?? render.data;
  if (!row) throw new ApiError(404, "Job tidak ditemukan.", "not_found");
  if (!["queued", "processing"].includes(row.status)) throw new ApiError(409, "Job sudah selesai.", "not_cancelable");
  const kind = ai.data ? "ai" : "render";
  const table = kind === "ai" ? "ai_generation_jobs" : "render_jobs";
  const admin = createAdminClient();
  await admin.from(table).update({ status: "canceled", completed_at: new Date().toISOString(), error_message: "Dibatalkan oleh pengguna." }).eq("id", id).in("status", ["queued", "processing"]);
  if (row.status === "queued") {
    await removeQueued(kind, id).catch(() => undefined);
    await admin.rpc("refund_job_credits", { p_job_id: id, p_job_table: table, p_reason: "Pengembalian kredit: job dibatalkan" });
  }
  // Running jobs: the worker detects the cancel flag and refunds.
  return json({ ok: true });
});
