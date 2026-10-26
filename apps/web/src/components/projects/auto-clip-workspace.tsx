"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Captions, Pencil, RefreshCw, Scissors, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useJobs } from "@/hooks/use-jobs";
import { useUpload } from "@/hooks/use-upload";
import { Dropzone } from "@/components/upload/dropzone";
import { api } from "@/lib/client-api";
import type { ClipDTO, JobDTO, TranscriptDTO } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { PipelineSteps, type Step } from "./pipeline";
import { ClipCard } from "./clip-card";

type Source = { id: string; status: string; duration: number | null; name: string | null; url: string | null } | null;

export function AutoClipWorkspace({
  project,
  source,
  transcript,
  clips,
}: {
  project: { id: string; title: string; settings: Record<string, unknown> };
  source: Source;
  transcript: TranscriptDTO | null;
  clips: ClipDTO[];
}) {
  const router = useRouter();
  const { upload, uploads } = useUpload();
  const [focus, setFocus] = useState((project.settings.autoClip as { focus?: string } | undefined)?.focus ?? "");
  const { jobs, refresh } = useJobs({ projectId: project.id, onSettled: () => router.refresh() });

  const latest = (type: string) => jobs.find((j) => j.type === type);
  const pipelineNote = project.settings.pipelineNote as string | null | undefined;

  const steps: Step[] = useMemo(() => {
    const st = (job: JobDTO | undefined, done: boolean): Step["state"] =>
      done ? "done" : job?.status === "failed" ? "failed" : job && ["queued", "processing"].includes(job.status) ? "active" : "pending";
    const probeDone = source?.status === "ready";
    const tJob = latest("transcription");
    const cJob = latest("clip_analysis");
    return [
      { label: "Unggah", state: source ? "done" : uploads[0]?.status === "uploading" ? "active" : "pending" },
      { label: "Analisis file", state: probeDone ? "done" : source?.status === "failed" ? "failed" : source ? "active" : "pending", detail: probeDone ? formatDuration(source?.duration) : null },
      { label: "Transkripsi", state: st(tJob, !!transcript), detail: tJob?.status === "failed" ? tJob.error_message : tJob && tJob.status === "processing" ? `${Math.round(tJob.progress * 100)}%` : null },
      { label: "Deteksi klip", state: st(cJob, clips.length > 0 && cJob?.status !== "processing" && cJob?.status !== "queued"), detail: cJob?.status === "failed" ? cJob.error_message : clips.length ? `${clips.length} kandidat` : null },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, source, transcript, clips, uploads]);

  const run = async (type: "transcription" | "clip_analysis") => {
    try {
      const input =
        type === "transcription"
          ? { assetId: source!.id, language: (project.settings.autoClip as { language?: string } | undefined)?.language }
          : { transcriptId: transcript!.id, focus: focus || undefined };
      const res = await api<{ creditsCost: number }>("/api/jobs", { method: "POST", json: { type, projectId: project.id, input } });
      toast.success(res.creditsCost ? `Job dimulai (${res.creditsCost} kredit).` : "Job dimulai.");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const active = jobs.some((j) => ["queued", "processing"].includes(j.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description="Auto-clip: kandidat klip pendek dari video panjang Anda."
        actions={
          <>
            {transcript && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/projects/${project.id}/transcript`}><Captions /> Transkrip</Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="p-5">
        <PipelineSteps steps={steps} />
        {pipelineNote?.startsWith("insufficient_credits") && (
          <div className="mt-4">
            <Notice variant="warning" title="Kredit tidak cukup">
              Proses otomatis berhenti karena kredit tidak cukup. <Link href="/app/usage" className="underline">Tambah kredit</Link> lalu lanjutkan secara manual.
            </Notice>
          </div>
        )}
        {jobs.filter((j) => ["queued", "processing"].includes(j.status)).map((j) => (
          <div key={j.id} className="mt-4 flex items-center gap-3">
            <span className="w-28 text-xs text-muted-foreground">{j.type === "transcription" ? "Transkripsi" : j.type === "clip_analysis" ? "Deteksi klip" : j.type}</span>
            <Progress value={j.progress * 100} className="flex-1" />
          </div>
        ))}
        <div className="mt-5 flex flex-wrap gap-2">
          {source?.status === "ready" && !transcript && !active && (
            <Button size="sm" onClick={() => run("transcription")}><Captions /> Transkripsi sekarang</Button>
          )}
          {transcript && !active && (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Fokus topik (opsional)" className="sm:max-w-xs" />
              <Button size="sm" variant="outline" onClick={() => run("clip_analysis")}><RefreshCw /> Analisis ulang klip</Button>
            </div>
          )}
        </div>
        {transcript?.is_demo && (
          <div className="mt-4">
            <Notice variant="warning" title="Transkrip DEMO">Transkrip ini berisi placeholder, bukan hasil AI dari audio Anda. Konfigurasikan penyedia transkripsi untuk hasil nyata.</Notice>
          </div>
        )}
      </Card>

      {!source && (
        <Card className="p-5">
          <p className="mb-3 font-medium">Unggah video sumber</p>
          <Dropzone
            accept="video/*"
            onFile={async (f) => {
              try {
                await upload(f, project.id);
                router.refresh();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            hint="MP4, MOV, WEBM, MKV"
          />
          {uploads[0] && <Progress className="mt-3" value={uploads[0].progress * 100} />}
        </Card>
      )}
      {source?.status === "failed" && (
        <Notice variant="error" title="File tidak dapat diproses">
          Video tidak valid atau rusak. <Upload className="inline size-3" /> Unggah ulang file lain.
        </Notice>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Kandidat klip</h2>
          {clips.length > 0 && (
            <p className="text-xs text-muted-foreground">Skor = heuristik transparan, bukan prediksi viral.</p>
          )}
        </div>
        {clips.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {clips.map((c) => (
              <ClipCard key={c.id} clip={c} sourceUrl={source?.url ?? null} sourceDuration={source?.duration ?? null} onChanged={() => router.refresh()} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Scissors} title="Belum ada kandidat klip" description="Kandidat akan muncul setelah transkripsi dan analisis selesai." />
        )}
      </section>
      {clips.some((c) => c.derived_project_id) && (
        <p className="text-xs text-muted-foreground">
          <Pencil className="mr-1 inline size-3" /> Klip yang sudah dibuka di editor ditandai <Badge variant="success">Di editor</Badge>
        </p>
      )}
    </div>
  );
}
