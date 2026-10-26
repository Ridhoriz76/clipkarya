import { AI_JOB_TYPES } from "@clipkarya/core";
import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";
import { createAiJob } from "@/lib/jobs";
import type { JobDTO } from "@/lib/types";

const createBody = z.object({
  type: z.enum(AI_JOB_TYPES).exclude(["probe"]),
  projectId: z.uuid().nullable().optional(),
  input: z.record(z.string(), z.unknown()),
});

export const POST = withAuth(async ({ req, userId, supabase }) => {
  const b = await parseBody(req, createBody);
  const job = await createAiJob({ supabase, userId, type: b.type, projectId: b.projectId, input: b.input });
  return json(job, 202);
});

const listQuery = z.object({
  projectId: z.uuid().optional(),
  ids: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const AI_COLS = "id, type, status, progress, stage, error_message, credits_cost, is_demo, output, project_id, created_at, completed_at";
const RENDER_COLS = "id, status, progress, stage, error_message, credits_cost, output_asset_id, srt_asset_id, project_id, created_at, completed_at, settings";

/** Unified job feed (AI + render) for polling. */
export const GET = withAuth(async ({ req, supabase }) => {
  const q = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const ids = q.ids?.split(",").filter((s) => z.uuid().safeParse(s).success).slice(0, 50);
  let ai = supabase.from("ai_generation_jobs").select(AI_COLS).neq("type", "probe").order("created_at", { ascending: false }).limit(q.limit);
  let render = supabase.from("render_jobs").select(RENDER_COLS).order("created_at", { ascending: false }).limit(q.limit);
  if (q.projectId) {
    ai = ai.eq("project_id", q.projectId);
    render = render.eq("project_id", q.projectId);
  }
  if (ids?.length) {
    ai = supabase.from("ai_generation_jobs").select(AI_COLS).in("id", ids);
    render = supabase.from("render_jobs").select(RENDER_COLS).in("id", ids);
  }
  const [a, r] = await Promise.all([ai, render]);
  if (a.error) throw new Error(a.error.message);
  if (r.error) throw new Error(r.error.message);
  const jobs: JobDTO[] = [
    ...(a.data ?? []).map((j) => ({ ...j, kind: "ai" as const })),
    ...(r.data ?? []).map((j) => ({ ...j, kind: "render" as const, type: "render" })),
  ].sort((x, y) => y.created_at.localeCompare(x.created_at)) as JobDTO[];
  return json({ jobs });
});
