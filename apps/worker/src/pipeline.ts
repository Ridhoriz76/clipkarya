import { estimateAiJobCredits, isFreeMode, jobInputSchemas, QUEUES, type AiJobType, type QueuePayload } from "@clipkarya/core";
import type { Queue } from "bullmq";
import { db } from "./supabase";

/**
 * Server-side chaining for the auto-clip and transcriber workflows, so the pipeline keeps going
 * even if the user closes the browser:
 *   probe (source video) → transcription → clip_analysis (auto-clip only)
 * Each follow-up job reserves credits exactly like a user-submitted job.
 */
export type AutoClipSettings = {
  autoPipeline?: boolean;
  language?: string;
  focus?: string;
  minDuration?: number;
  maxDuration?: number;
  maxCandidates?: number;
};

let aiQueue: Queue<QueuePayload> | null = null;
export function setAiQueue(q: Queue<QueuePayload>) {
  aiQueue = q;
}

async function projectSettings(projectId: string | null): Promise<{ mode: string; settings: { autoClip?: AutoClipSettings } } | null> {
  if (!projectId) return null;
  const { data } = await db().from("projects").select("mode, settings").eq("id", projectId).maybeSingle();
  return data as { mode: string; settings: { autoClip?: AutoClipSettings } } | null;
}

async function setPipelineNote(projectId: string, note: string | null) {
  const { data } = await db().from("projects").select("settings").eq("id", projectId).single<{ settings: Record<string, unknown> }>();
  await db().from("projects").update({ settings: { ...(data?.settings ?? {}), pipelineNote: note } }).eq("id", projectId);
}

export async function enqueueFollowUp(opts: { userId: string; projectId: string; type: AiJobType; input: unknown; mediaDurationSec?: number }) {
  if (!aiQueue) throw new Error("AI queue not initialised");
  const input = jobInputSchemas[opts.type].parse(opts.input);
  const cost = isFreeMode() ? 0 : estimateAiJobCredits(opts.type, input as never, { mediaDurationSec: opts.mediaDurationSec });
  const { data: job, error } = await db()
    .from("ai_generation_jobs")
    .insert({ user_id: opts.userId, project_id: opts.projectId, type: opts.type, input, credits_cost: cost })
    .select("id")
    .single<{ id: string }>();
  if (error || !job) throw new Error(error?.message);
  if (cost > 0) {
    const { error: spendErr } = await db().rpc("spend_credits", {
      p_user: opts.userId,
      p_amount: cost,
      p_reason: `Job ${opts.type} (otomatis)`,
      p_job_id: job.id,
      p_job_table: "ai_generation_jobs",
    });
    if (spendErr) {
      await db().from("ai_generation_jobs").delete().eq("id", job.id);
      await setPipelineNote(opts.projectId, spendErr.message.includes("insufficient_credits") ? `insufficient_credits:${opts.type}:${cost}` : `error:${opts.type}`);
      return null;
    }
  }
  await aiQueue.add("ai", { jobId: job.id, userId: opts.userId, kind: "ai" }, { jobId: job.id, attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: { age: 86400 } });
  return job.id;
}

/** Called after an AI job completes successfully. */
export async function onAiJobCompleted(jobId: string): Promise<void> {
  const { data: job } = await db().from("ai_generation_jobs").select("type, user_id, project_id, input, output").eq("id", jobId).single<{
    type: string;
    user_id: string;
    project_id: string | null;
    input: Record<string, unknown>;
    output: Record<string, unknown> | null;
  }>();
  if (!job?.project_id) return;
  const project = await projectSettings(job.project_id);
  const s = project?.settings.autoClip;
  if (!project || !["auto_clip", "transcriber"].includes(project.mode) || !s?.autoPipeline) return;

  if (job.type === "probe") {
    const { data: asset } = await db().from("media_assets").select("id, kind, duration_sec").eq("id", job.input.assetId as string).single<{ id: string; kind: string; duration_sec: number | null }>();
    const { data: proj } = await db().from("projects").select("source_asset_id").eq("id", job.project_id).single<{ source_asset_id: string | null }>();
    if (!asset || !["video", "audio"].includes(asset.kind) || proj?.source_asset_id !== asset.id) return;
    await setPipelineNote(job.project_id, null);
    await enqueueFollowUp({
      userId: job.user_id,
      projectId: job.project_id,
      type: "transcription",
      input: { assetId: asset.id, language: s.language || undefined, diarize: false },
      mediaDurationSec: asset.duration_sec ?? undefined,
    });
  } else if (job.type === "transcription" && job.output?.transcriptId && project.mode === "auto_clip") {
    await enqueueFollowUp({
      userId: job.user_id,
      projectId: job.project_id,
      type: "clip_analysis",
      input: {
        transcriptId: job.output.transcriptId,
        focus: s.focus || undefined,
        minDuration: s.minDuration ?? 15,
        maxDuration: s.maxDuration ?? 60,
        maxCandidates: s.maxCandidates ?? 8,
      },
    });
  }
}

export const AI_QUEUE_NAME = QUEUES.ai;
