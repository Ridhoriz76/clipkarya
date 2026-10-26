"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Pause, Play, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/client-api";
import type { ClipDTO } from "@/lib/types";
import { formatTimecode } from "@/lib/utils";

const BREAKDOWN_LABELS: Record<string, string> = {
  hook: "Hook pembuka",
  completeness: "Kelengkapan kalimat",
  pacing: "Tempo bicara",
  density: "Kepadatan ucapan",
  lengthFit: "Kecocokan durasi",
  relevance: "Relevansi fokus",
};

export function ClipCard({ clip, sourceUrl, sourceDuration, onChanged }: { clip: ClipDTO; sourceUrl: string | null; sourceDuration: number | null; onChanged: () => void }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [start, setStart] = useState(clip.start_sec);
  const [end, setEnd] = useState(clip.end_sec);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = Math.abs(start - clip.start_sec) > 0.01 || Math.abs(end - clip.end_sec) > 0.01;

  // Constrain playback to the clip range: this is the real source media, not a separate render.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= end) {
        v.pause();
        v.currentTime = start;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [start, end]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start;
      void v.play();
    } else v.pause();
  };

  const save = async () => {
    setBusy("save");
    try {
      await api(`/api/clips/${clip.id}`, { method: "PATCH", json: { start_sec: start, end_sec: end } });
      toast.success("Rentang klip disimpan.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openInEditor = async () => {
    setBusy("edit");
    try {
      if (dirty) await api(`/api/clips/${clip.id}`, { method: "PATCH", json: { start_sec: start, end_sec: end } });
      if (clip.derived_project_id && !dirty) return router.push(`/app/projects/${clip.derived_project_id}/edit`);
      const { projectId } = await api<{ projectId: string }>(`/api/clips/${clip.id}/create-project`, { method: "POST", json: { captions: true } });
      router.push(`/app/projects/${projectId}/edit`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const dismiss = async () => {
    await api(`/api/clips/${clip.id}`, { method: "PATCH", json: { status: "dismissed" } }).catch((e) => toast.error((e as Error).message));
    onChanged();
  };

  const max = sourceDuration ?? Infinity;
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v * 10) / 10));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-video w-full shrink-0 bg-black sm:aspect-[9/16] sm:w-44">
          {sourceUrl ? (
            <video
              ref={video}
              src={`${sourceUrl}#t=${clip.start_sec}`}
              poster={clip.thumbnailUrl ?? undefined}
              preload="metadata"
              playsInline
              className="size-full object-cover"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={toggle}
            />
          ) : clip.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : null}
          <button onClick={toggle} className="absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-white" aria-label={playing ? "Jeda" : "Putar pratinjau"}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="flex items-start gap-2">
            <p className="line-clamp-2 flex-1 text-sm font-medium">“{clip.hook_text || clip.title}”</p>
            <Tooltip content={<ScoreBreakdown clip={clip} />}>
              <span className="shrink-0 cursor-help rounded-lg bg-primary/15 px-2 py-1 text-sm font-semibold tabular-nums text-primary">{clip.score}</span>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clip.reasons.slice(0, 3).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
            {clip.derived_project_id && <Badge variant="success">Di editor</Badge>}
          </div>
          <p className="line-clamp-3 text-xs text-muted-foreground">{clip.transcript_excerpt}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Mulai (detik)
              <Input type="number" step={0.1} min={0} value={start} onChange={(e) => setStart(clamp(Number(e.target.value)))} className="h-8" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Selesai (detik)
              <Input type="number" step={0.1} min={0} value={end} onChange={(e) => setEnd(clamp(Number(e.target.value)))} className="h-8" />
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatTimecode(start)} – {formatTimecode(end)} · {(end - start).toFixed(1)} dtk</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => video.current && setStart(clamp(video.current.currentTime))}>Set mulai</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => video.current && setEnd(clamp(video.current.currentTime))}>Set akhir</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openInEditor} disabled={!!busy || end - start < 1}>
              {busy === "edit" ? <Loader2 className="animate-spin" /> : clip.derived_project_id && !dirty ? <ExternalLink /> : <Wand2 />}
              {clip.derived_project_id && !dirty ? "Buka di editor" : "Edit & tambah caption"}
            </Button>
            {dirty && <Button size="sm" variant="outline" onClick={save} disabled={!!busy}>Simpan rentang</Button>}
            <Button size="sm" variant="ghost" onClick={dismiss} className="ml-auto" aria-label="Abaikan klip"><Trash2 /></Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScoreBreakdown({ clip }: { clip: ClipDTO }) {
  return (
    <div className="w-56 space-y-1.5">
      <p className="font-medium">Rincian skor (heuristik)</p>
      {Object.entries(clip.score_breakdown).map(([k, v]) =>
        v === null ? null : (
          <div key={k} className="flex items-center gap-2">
            <span className="w-28 text-muted-foreground">{BREAKDOWN_LABELS[k] ?? k}</span>
            <div className="h-1 flex-1 rounded bg-muted"><div className="h-1 rounded bg-primary" style={{ width: `${Math.round(Number(v) * 100)}%` }} /></div>
            <span className="w-7 text-right tabular-nums">{Math.round(Number(v) * 100)}</span>
          </div>
        ),
      )}
    </div>
  );
}
