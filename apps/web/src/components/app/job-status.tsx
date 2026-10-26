"use client";
import { CheckCircle2, CircleSlash, Loader2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { formatRelative } from "@/lib/utils";
import type { JobDTO } from "@/lib/types";
import { id as dict } from "@/lib/i18n/id";
import { toast } from "sonner";

const STAGES: Record<string, string> = {
  download: "Mengunduh media",
  probe: "Menganalisis file",
  extract_audio: "Mengekstrak audio",
  transcribing: "Mentranskripsi",
  saving: "Menyimpan",
  scoring: "Menilai segmen",
  thumbnails: "Membuat pratinjau",
  synthesizing: "Membuat suara",
  writing: "Menulis naskah",
  generating: "Menghasilkan",
  fetching_media: "Menyiapkan media",
  rendering: "Merender video",
  uploading: "Mengunggah hasil",
  retrying: "Mencoba ulang",
  done: "Selesai",
};

export function JobStatusBadge({ status }: { status: JobDTO["status"] }) {
  const map = {
    queued: { v: "outline" as const, icon: Clock },
    processing: { v: "default" as const, icon: Loader2 },
    completed: { v: "success" as const, icon: CheckCircle2 },
    failed: { v: "destructive" as const, icon: XCircle },
    canceled: { v: "secondary" as const, icon: CircleSlash },
  }[status];
  return (
    <Badge variant={map.v}>
      <map.icon className={`size-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {dict.status[status]}
    </Badge>
  );
}

export function JobRow({ job, onChange }: { job: JobDTO; onChange?: () => void }) {
  const active = job.status === "queued" || job.status === "processing";
  const stageLabel = job.stage ? (STAGES[job.stage] ?? (job.stage.startsWith("queue:") ? `Antrean penyedia #${job.stage.slice(6)}` : job.stage)) : null;
  const cancel = async () => {
    try {
      await api(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      toast.success(job.credits_cost > 0 ? "Job dibatalkan. Kredit dikembalikan." : "Job dibatalkan.");
      onChange?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{dict.jobTypes[job.type as keyof typeof dict.jobTypes] ?? job.type}</span>
        {job.is_demo && <Badge variant="demo">DEMO</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(job.created_at)}</span>
        <JobStatusBadge status={job.status} />
      </div>
      {active && (
        <div className="flex items-center gap-3">
          <Progress value={Math.round(job.progress * 100)} className="flex-1" />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(job.progress * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={cancel}>Batal</Button>
        </div>
      )}
      {active && stageLabel && <p className="text-xs text-muted-foreground">{stageLabel}</p>}
      {job.status === "failed" && job.error_message && <p className="text-xs text-destructive">{job.error_message}</p>}
      {job.credits_cost > 0 && <p className="text-xs text-muted-foreground">{job.credits_cost} kredit{job.status === "failed" || job.status === "canceled" ? " · dikembalikan" : ""}</p>}
    </div>
  );
}
