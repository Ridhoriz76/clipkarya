import { mkdir } from "node:fs/promises";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { QUEUES, type QueuePayload } from "@clipkarya/core";
import { capabilityAvailability } from "@clipkarya/core/providers";
import { env } from "./env";
import { runJob } from "./runner";
import { runMaintenance } from "./maintenance";
import { probeJob } from "./jobs/probe";
import { transcriptionJob } from "./jobs/transcription";
import { clipAnalysisJob } from "./jobs/clipAnalysis";
import { voiceJob } from "./jobs/voice";
import { scriptJob } from "./jobs/script";
import { imageJob } from "./jobs/image";
import { videoJob } from "./jobs/video";
import { renderJob } from "./jobs/render";
import type { AiJobRow, RenderJobRow } from "./jobs/types";
import { db } from "./supabase";
import { onAiJobCompleted, setAiQueue } from "./pipeline";

const handlers = {
  probe: probeJob,
  transcription: transcriptionJob,
  clip_analysis: clipAnalysisJob,
  voice: voiceJob,
  script: scriptJob,
  image: imageJob,
  video: videoJob,
} as const;

function isFinal(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

async function main() {
  const e = env();
  await mkdir(e.WORKER_TMP_DIR, { recursive: true });
  const connection = new Redis(e.REDIS_URL, { maxRetriesPerRequest: null });

  const aiWorker = new Worker<QueuePayload>(
    QUEUES.ai,
    async (job) => {
      const { data } = await db().from("ai_generation_jobs").select("type").eq("id", job.data.jobId).single<{ type: keyof typeof handlers }>();
      const handler = data ? handlers[data.type] : undefined;
      if (!handler) throw new Error(`Unknown AI job ${job.data.jobId}`);
      await runJob<AiJobRow, Record<string, unknown>>("ai_generation_jobs", job.data.jobId, handler, { isFinalAttempt: isFinal(job) });
      const { data: after } = await db().from("ai_generation_jobs").select("status").eq("id", job.data.jobId).single<{ status: string }>();
      if (after?.status === "completed") await onAiJobCompleted(job.data.jobId).catch((err) => console.error("[pipeline]", err));
    },
    { connection, concurrency: e.WORKER_AI_CONCURRENCY },
  );

  const renderWorker = new Worker<QueuePayload>(
    QUEUES.render,
    async (job) => {
      await runJob<RenderJobRow, null>("render_jobs", job.data.jobId, renderJob, { isFinalAttempt: isFinal(job) });
    },
    // Renders are CPU-heavy; long lock so a busy FFmpeg doesn't look stalled.
    { connection, concurrency: e.WORKER_RENDER_CONCURRENCY, lockDuration: 120_000 },
  );

  setAiQueue(new Queue<QueuePayload>(QUEUES.ai, { connection }));
  const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });
  await maintenanceQueue.upsertJobScheduler("maintenance-every-15m", { every: 15 * 60_000 }, { name: "maintenance" });
  const maintenanceWorker = new Worker(
    QUEUES.maintenance,
    async () => {
      const r = await runMaintenance();
      console.info("[maintenance]", r);
      return r;
    },
    { connection, concurrency: 1 },
  );

  for (const w of [aiWorker, renderWorker, maintenanceWorker]) {
    w.on("failed", (job, err) => console.warn(`[${w.name}] job ${job?.id} attempt failed: ${err.message}`));
    w.on("error", (err) => console.error(`[${w.name}] error`, err));
  }

  console.info("[worker] ready", { queues: Object.values(QUEUES), providers: capabilityAvailability() });

  const shutdown = async (sig: string) => {
    console.info(`[worker] ${sig} received, draining…`);
    await Promise.allSettled([aiWorker.close(), renderWorker.close(), maintenanceWorker.close(), maintenanceQueue.close()]);
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
