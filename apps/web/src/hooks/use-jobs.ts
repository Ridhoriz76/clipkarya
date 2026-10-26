"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { JobDTO } from "@/lib/types";

const ACTIVE = new Set(["queued", "processing"]);

/**
 * Poll job status. Pass explicit ids to track specific jobs, or a projectId for a project's feed.
 * Polls every 2s while any tracked job is active, then backs off to 15s.
 */
export function useJobs(opts: { ids?: string[]; projectId?: string; onSettled?: (job: JobDTO) => void }) {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const settled = useRef(new Set<string>());
  const onSettledRef = useRef(opts.onSettled);
  useLayoutEffect(() => {
    onSettledRef.current = opts.onSettled;
  });
  const key = opts.ids?.join(",") ?? "";

  const refresh = useCallback(async () => {
    if (!key && !opts.projectId) return [];
    const qs = key ? `ids=${key}` : `projectId=${opts.projectId}`;
    const { jobs } = await api<{ jobs: JobDTO[] }>(`/api/jobs?${qs}`);
    setJobs(jobs);
    for (const j of jobs) {
      if (!ACTIVE.has(j.status) && !settled.current.has(j.id)) {
        settled.current.add(j.id);
        onSettledRef.current?.(j);
      }
    }
    return jobs;
  }, [key, opts.projectId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      try {
        const js = await refresh();
        if (stopped) return;
        timer = setTimeout(tick, js.some((j) => ACTIVE.has(j.status)) ? 2000 : 15000);
      } catch {
        if (!stopped) timer = setTimeout(tick, 5000);
      }
    };
    // Jobs that were already finished when first seen are not "newly settled".
    settled.current = new Set();
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  return { jobs, refresh, active: jobs.filter((j) => ACTIVE.has(j.status)) };
}
