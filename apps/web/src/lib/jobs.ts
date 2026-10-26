import "server-only";
import {
  estimateAiJobCredits,
  estimateRenderCredits,
  FREE_DAILY_LIMITS,
  isFreeMode,
  jobInputSchemas,
  renderSettingsSchema,
  timelineDuration,
  timelineSchema,
  validateTimeline,
  type AiJobType,
  type JobInput,
} from "@clipkarya/core";
import { capabilityAvailability } from "@clipkarya/core/providers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueue } from "@/lib/queue";
import { rateLimit } from "@/lib/rate-limit";

const CAPABILITY: Partial<Record<AiJobType, "text" | "transcription" | "speech" | "image" | "video">> = {
  transcription: "transcription",
  voice: "speech",
  script: "text",
  image: "image",
  video: "video",
};

/** Per-type rate limits for costly endpoints (requests per minute). */
const RATE: Record<AiJobType | "render", number> = {
  probe: 60,
  transcription: 10,
  clip_analysis: 10,
  voice: 30,
  script: 10,
  image: 10,
  video: 5,
  render: 6,
};

/** Free mode: cap jobs per user per 24h so free usage can't run up unbounded provider bills. */
async function assertDailyLimit(admin: SupabaseClient, userId: string, type: AiJobType | "render") {
  if (!isFreeMode()) return;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const q = type === "render" ? admin.from("render_jobs").select("id", { count: "exact", head: true }) : admin.from("ai_generation_jobs").select("id", { count: "exact", head: true }).eq("type", type);
  const { count } = await q.eq("user_id", userId).gte("created_at", since).neq("status", "canceled");
  const limit = FREE_DAILY_LIMITS[type];
  if ((count ?? 0) >= limit) throw new ApiError(429, `Batas pemakaian harian tercapai (${limit} per 24 jam untuk fitur ini). Coba lagi besok.`, "daily_limit", { limit });
}

async function assertProjectOwner(supabase: SupabaseClient, projectId: string | null | undefined) {
  if (!projectId) return;
  const { data } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!data) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
}

/**
 * Create an AI job: validate input, verify ownership with the user's RLS client,
 * reserve credits atomically, persist the job row, then enqueue it.
 */
export async function createAiJob<T extends AiJobType>(opts: {
  supabase: SupabaseClient; // user-scoped (RLS) client
  userId: string;
  type: T;
  projectId?: string | null;
  input: unknown;
}): Promise<{ id: string; creditsCost: number }> {
  const { supabase, userId, type } = opts;
  await rateLimit(userId, `job:${type}`, RATE[type], 60);
  const input = jobInputSchemas[type].parse(opts.input) as JobInput<T>;
  await assertProjectOwner(supabase, opts.projectId);

  const cap = CAPABILITY[type];
  if (cap && !capabilityAvailability()[cap].available) {
    throw new ApiError(503, "Penyedia AI untuk fitur ini belum dikonfigurasi oleh admin.", "provider_not_configured", { capability: cap });
  }

  // Ownership checks for referenced records (RLS client → only own rows are visible).
  let mediaDurationSec: number | undefined;
  if ("assetId" in (input as object)) {
    const { data: asset } = await supabase
      .from("media_assets")
      .select("id, status, duration_sec, kind")
      .eq("id", (input as { assetId: string }).assetId)
      .maybeSingle<{ id: string; status: string; duration_sec: number | null; kind: string }>();
    if (!asset) throw new ApiError(404, "Media tidak ditemukan.", "not_found");
    if (type !== "probe" && asset.status !== "ready") throw new ApiError(409, "Media belum siap diproses.", "asset_not_ready");
    mediaDurationSec = asset.duration_sec ?? undefined;
  }
  if (type === "clip_analysis") {
    const { data } = await supabase.from("transcripts").select("id").eq("id", (input as JobInput<"clip_analysis">).transcriptId).maybeSingle();
    if (!data) throw new ApiError(404, "Transkrip tidak ditemukan.", "not_found");
  }

  const admin = createAdminClient();
  await assertDailyLimit(admin, userId, type);
  const cost = isFreeMode() ? 0 : estimateAiJobCredits(type, input, { mediaDurationSec });
  const { data: job, error } = await admin
    .from("ai_generation_jobs")
    .insert({ user_id: userId, project_id: opts.projectId ?? null, type, input, credits_cost: cost, status: "queued" })
    .select("id")
    .single<{ id: string }>();
  if (error || !job) throw new Error(`job insert: ${error?.message}`);

  if (cost > 0) {
    const { error: spendErr } = await admin.rpc("spend_credits", {
      p_user: userId,
      p_amount: cost,
      p_reason: `Job ${type}`,
      p_job_id: job.id,
      p_job_table: "ai_generation_jobs",
    });
    if (spendErr) {
      await admin.from("ai_generation_jobs").delete().eq("id", job.id);
      if (spendErr.message.includes("insufficient_credits"))
        throw new ApiError(402, "Kredit Anda tidak cukup. Upgrade paket untuk melanjutkan.", "insufficient_credits", { required: cost });
      throw new Error(spendErr.message);
    }
  }
  await enqueueOrRefund(admin, "ai", job.id, userId);
  return { id: job.id, creditsCost: cost };
}

export async function createRenderJob(opts: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  settings: unknown;
}): Promise<{ id: string; creditsCost: number }> {
  const { supabase, userId, projectId } = opts;
  await rateLimit(userId, "job:render", RATE.render, 60);
  const settings = renderSettingsSchema.parse(opts.settings);
  await assertProjectOwner(supabase, projectId);

  // Snapshot the persisted timeline: the export reflects exactly what was saved.
  const { data: doc, error: tlErr } = await supabase.rpc("get_timeline", { p_project: projectId });
  if (tlErr || !doc) throw new ApiError(404, "Timeline tidak ditemukan.", "not_found");
  const timeline = timelineSchema.parse({ ...doc, resolution: settings.resolution });
  const issues = validateTimeline(timeline);
  if (issues.length) throw new ApiError(422, `Timeline tidak valid: ${issues[0]!.message}`, "invalid_timeline");
  const duration = timelineDuration(timeline);
  if (duration <= 0) throw new ApiError(422, "Timeline kosong.", "empty_timeline");
  if (duration > 15 * 60) throw new ApiError(422, "Durasi ekspor maksimal 15 menit.", "too_long");

  // Plan limits (resolution). Everything is unlocked in free mode.
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("plan:subscription_plans(max_export_resolution)")
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle<{ plan: { max_export_resolution: string } | null }>();
  if (!isFreeMode() && settings.resolution === "1080p" && sub?.plan?.max_export_resolution === "720p") {
    throw new ApiError(402, "Ekspor 1080p tersedia di paket berbayar.", "plan_limit");
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"]);
  if ((count ?? 0) >= 2) throw new ApiError(429, "Maksimal 2 render berjalan bersamaan.", "too_many_renders");

  await assertDailyLimit(admin, userId, "render");
  const cost = isFreeMode() ? 0 : estimateRenderCredits(duration, settings.resolution);
  const { data: job, error } = await admin
    .from("render_jobs")
    .insert({ user_id: userId, project_id: projectId, settings, timeline_snapshot: timeline, credits_cost: cost, duration_sec: duration })
    .select("id")
    .single<{ id: string }>();
  if (error || !job) throw new Error(`render insert: ${error?.message}`);
  if (cost > 0) {
    const { error: spendErr } = await admin.rpc("spend_credits", {
      p_user: userId,
      p_amount: cost,
      p_reason: "Render video",
      p_job_id: job.id,
      p_job_table: "render_jobs",
    });
    if (spendErr) {
      await admin.from("render_jobs").delete().eq("id", job.id);
      if (spendErr.message.includes("insufficient_credits"))
        throw new ApiError(402, "Kredit Anda tidak cukup untuk ekspor.", "insufficient_credits", { required: cost });
      throw new Error(spendErr.message);
    }
  }
  await admin.from("projects").update({ status: "processing" }).eq("id", projectId);
  await enqueueOrRefund(admin, "render", job.id, userId);
  return { id: job.id, creditsCost: cost };
}

async function enqueueOrRefund(admin: SupabaseClient, kind: "ai" | "render", jobId: string, userId: string) {
  const table = kind === "ai" ? "ai_generation_jobs" : "render_jobs";
  try {
    await enqueue(kind, jobId, userId);
  } catch (err) {
    console.error("[jobs] enqueue failed", err);
    await admin.from(table).update({ status: "failed", error_message: "Antrean pemrosesan tidak tersedia." }).eq("id", jobId);
    await admin.rpc("refund_job_credits", { p_job_id: jobId, p_job_table: table, p_reason: "Pengembalian kredit: antrean tidak tersedia" });
    throw new ApiError(503, "Layanan pemrosesan sedang tidak tersedia. Coba lagi nanti.", "queue_unavailable");
  }
}
