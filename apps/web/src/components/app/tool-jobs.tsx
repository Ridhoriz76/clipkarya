"use client";
import { useJobs } from "@/hooks/use-jobs";
import { JobRow } from "./job-status";

/** Shows live progress for jobs submitted from a tool page. */
export function ToolJobs({ ids, onSettled }: { ids: string[]; onSettled: () => void }) {
  const { jobs, refresh } = useJobs({ ids, onSettled });
  if (!ids.length) return null;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
      {jobs.map((j) => <JobRow key={j.id} job={j} onChange={() => void refresh()} />)}
    </div>
  );
}
