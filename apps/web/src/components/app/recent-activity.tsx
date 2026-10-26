"use client";
import { useJobs } from "@/hooks/use-jobs";
import { JobRow } from "./job-status";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { JobDTO } from "@/lib/types";

/** Latest jobs across all projects; polls while any are active. */
export function RecentActivity() {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    api<{ jobs: JobDTO[] }>("/api/jobs?limit=6").then(({ jobs }) => setIds(jobs.slice(0, 6).map((j) => j.id))).catch(() => setIds([]));
  }, []);
  const { jobs, refresh } = useJobs({ ids: ids ?? [] });
  if (ids === null) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (!ids.length) return <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>;
  return (
    <div className="divide-y divide-border">
      {jobs.slice(0, 6).map((j) => <JobRow key={j.id} job={j} onChange={() => void refresh()} />)}
    </div>
  );
}
