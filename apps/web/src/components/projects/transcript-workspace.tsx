"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Captions, Download, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { useJobs } from "@/hooks/use-jobs";
import { api } from "@/lib/client-api";
import type { TranscriptDTO } from "@/lib/types";
import { formatTimecode } from "@/lib/utils";

type Source = { id: string; status: string; duration: number | null; name: string | null; url: string | null } | null;

export function TranscriptWorkspace({ project, source, transcript }: { project: { id: string; title: string }; source: Source; transcript: TranscriptDTO | null }) {
  const router = useRouter();
  const media = useRef<HTMLVideoElement>(null);
  const [query, setQuery] = useState("");
  const [segments, setSegments] = useState(transcript?.segments ?? []);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(0);
  const { jobs } = useJobs({ projectId: project.id, onSettled: () => router.refresh() });
  const activeJob = jobs.find((j) => ["queued", "processing"].includes(j.status));
  const failedJob = !transcript ? jobs.find((j) => j.type === "transcription" && j.status === "failed") : undefined;
  const dirty = JSON.stringify(segments) !== JSON.stringify(transcript?.segments ?? []);
  const speakers = new Set(segments.map((s) => s.speaker).filter(Boolean));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return segments.map((s, i) => ({ s, i })).filter(({ s }) => !q || s.text.toLowerCase().includes(q));
  }, [segments, query]);

  const seek = (t: number) => {
    if (media.current) {
      media.current.currentTime = t;
      void media.current.play();
    }
  };

  const save = async () => {
    if (!transcript) return;
    setSaving(true);
    try {
      await api(`/api/transcripts/${transcript.id}`, { method: "PATCH", json: { segments } });
      toast.success("Transkrip disimpan.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const transcribe = async () => {
    try {
      await api("/api/jobs", { method: "POST", json: { type: "transcription", projectId: project.id, input: { assetId: source!.id } } });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description="Transkrip dengan penanda waktu. Klik baris untuk memutar, klik teks untuk mengedit."
        actions={
          transcript && (
            <>
              <Button variant="outline" size="sm" asChild><a href={`/api/transcripts/${transcript.id}/subtitles?format=srt`}><Download /> SRT</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`/api/transcripts/${transcript.id}/subtitles?format=vtt`}><Download /> VTT</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`/api/transcripts/${transcript.id}/subtitles?format=srt&mode=short`}><Download /> SRT pendek</a></Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Simpan</Button>
            </>
          )
        }
      />
      {transcript?.is_demo && <Notice variant="warning" title="Transkrip DEMO">Teks ini placeholder berlabel [DEMO], bukan hasil transkripsi audio Anda.</Notice>}
      {activeJob && (
        <Card className="space-y-2 p-4">
          <p className="text-sm">{activeJob.type === "probe" ? "Menganalisis file…" : "Mentranskripsi…"}</p>
          <Progress value={activeJob.progress * 100} />
        </Card>
      )}
      {failedJob && <Notice variant="error" title="Transkripsi gagal">{failedJob.error_message}</Notice>}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="sticky top-0 space-y-3">
            {source?.url ? (
              <video ref={media} src={source.url} controls playsInline className="aspect-video w-full rounded-xl bg-black" onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">Media sedang diproses…</div>
            )}
            {transcript && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{transcript.provider}</Badge>
                {transcript.language && <Badge variant="outline">{transcript.language}</Badge>}
                <Badge variant="outline">{transcript.words.length ? "Penanda waktu per kata" : "Penanda waktu per kalimat"}</Badge>
                {speakers.size > 0 && <Badge variant="outline">{speakers.size} pembicara</Badge>}
                {transcript.edited && <Badge variant="secondary">Diedit</Badge>}
              </div>
            )}
            {source?.status === "ready" && !transcript && !activeJob && (
              <Button onClick={transcribe}><Captions /> Mulai transkripsi</Button>
            )}
          </div>
        </div>
        <div className="lg:col-span-3">
          {transcript ? (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-3">
                <Search className="size-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari dalam transkrip…" className="h-8 border-0 bg-transparent focus-visible:ring-0" />
                {query && <span className="shrink-0 text-xs text-muted-foreground">{filtered.length} hasil</span>}
              </div>
              <div className="max-h-[65vh] divide-y divide-border overflow-y-auto scrollbar-thin">
                {filtered.map(({ s, i }) => {
                  const isCurrent = current >= s.start && current < s.end;
                  return (
                    <div key={i} className={`flex gap-3 px-4 py-2.5 ${isCurrent ? "bg-primary/5" : ""}`}>
                      <button onClick={() => seek(s.start)} className="w-14 shrink-0 pt-0.5 text-left font-mono text-xs text-primary hover:underline">{formatTimecode(s.start)}</button>
                      <div className="min-w-0 flex-1">
                        {s.speaker && <p className="text-[11px] font-medium uppercase text-muted-foreground">{s.speaker}</p>}
                        {editing === i ? (
                          <Textarea
                            autoFocus
                            value={s.text}
                            onChange={(e) => setSegments((all) => all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                            onBlur={() => setEditing(null)}
                            className="min-h-14 text-sm"
                          />
                        ) : (
                          <p className="cursor-text text-sm leading-relaxed" onClick={() => setEditing(i)}>
                            <Highlight text={s.text} q={query} />
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <EmptyState icon={Captions} title="Belum ada transkrip" description="Transkrip muncul di sini setelah proses selesai." />
          )}
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-primary/30 px-0.5 text-foreground">{p}</mark> : p))}</>;
}
