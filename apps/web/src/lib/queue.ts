import "server-only";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUES, type QueuePayload } from "@clipkarya/core";

let redis: Redis | null = null;
const queues = new Map<string, Queue<QueuePayload>>();

export function getRedis(): Redis {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is not configured");
  redis ??= new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: false, lazyConnect: false });
  return redis;
}

function queue(name: string): Queue<QueuePayload> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue<QueuePayload>(name, { connection: getRedis() });
    queues.set(name, q);
  }
  return q;
}

/** Enqueue only the job id; the worker reads authoritative state from the database. */
export async function enqueue(kind: "ai" | "render", jobId: string, userId: string): Promise<void> {
  await queue(kind === "ai" ? QUEUES.ai : QUEUES.render).add(
    kind,
    { jobId, userId, kind },
    {
      jobId,
      attempts: kind === "ai" ? 3 : 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  );
}

export async function removeQueued(kind: "ai" | "render", jobId: string): Promise<void> {
  const job = await queue(kind === "ai" ? QUEUES.ai : QUEUES.render).getJob(jobId);
  if (job && (await job.isWaiting())) await job.remove();
}

export type QueueHealth = { name: string; counts: Record<string, number> } | { name: string; error: string };

/** Queue depth for the admin monitor; never throws (Redis may be down or unconfigured). */
export async function queueHealth(): Promise<QueueHealth[]> {
  const names = [QUEUES.ai, QUEUES.render];
  return Promise.all(
    names.map(async (name): Promise<QueueHealth> => {
      try {
        const counts = await Promise.race([
          queue(name).getJobCounts("waiting", "active", "delayed", "failed", "completed"),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Redis tidak merespons")), 3000)),
        ]);
        return { name, counts };
      } catch (e) {
        return { name, error: (e as Error).message };
      }
    }),
  );
}
