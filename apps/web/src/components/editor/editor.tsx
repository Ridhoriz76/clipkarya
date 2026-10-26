"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CloudOff, Copy, Loader2, Minus, Pause, Play, Plus, Redo2, Scissors, SkipBack, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { newId, splitItem, timelineDuration, type AudioItem, type Timeline } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useJobs } from "@/hooks/use-jobs";
import { api } from "@/lib/client-api";
import { formatTimecode } from "@/lib/utils";
import { ExportDialog } from "./export-dialog";
import { LeftPanel } from "./left-panel";
import { Preview } from "./preview";
import { PropertiesPanel } from "./properties";
import { TimelinePanel } from "./timeline";
import { PX_PER_SEC_DEFAULT, type EditorAsset, type SaveState } from "./types";
import { useEditorStore } from "./use-editor-store";

export function Editor({
  project,
  initialTimeline,
  initialVersion,
  initialAssets,
}: {
  project: { id: string; title: string };
  initialTimeline: Timeline;
  initialVersion: number;
  initialAssets: EditorAsset[];
}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const store = useEditorStore(project.id, initialTimeline, initialVersion, setSaveState);
  const { doc } = store;
  const [assets, setAssets] = useState(initialAssets);
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(PX_PER_SEC_DEFAULT);
  const [title, setTitle] = useState(project.title);
  const duration = timelineDuration(doc);
  const selected = doc.items.find((i) => i.id === selectedId) ?? null;

  const reloadAssets = useCallback(async () => {
    const { assets } = await api<{ assets: EditorAsset[] }>(`/api/assets?projectId=${project.id}`);
    // Keep assets referenced by the timeline from other projects (e.g. shared library media).
    setAssets((prev) => [...assets, ...prev.filter((p) => !assets.some((a) => a.id === p.id) && doc.items.some((i) => "assetId" in i && i.assetId === p.id))]);
  }, [project.id, doc.items]);

  // Refresh signed URLs periodically (they expire after an hour).
  useEffect(() => {
    const t = setInterval(() => void reloadAssets().catch(() => undefined), 45 * 60_000);
    return () => clearInterval(t);
  }, [reloadAssets]);

  // Voiceover jobs: when one completes, place it on the narration track.
  const [voiceJobs, setVoiceJobs] = useState<Record<string, number>>({});
  useJobs({
    ids: Object.keys(voiceJobs),
    onSettled: async (job) => {
      const placeAt = voiceJobs[job.id];
      setVoiceJobs((v) => {
        const n = { ...v };
        delete n[job.id];
        return n;
      });
      if (job.status !== "completed") return toast.error(job.error_message ?? "Voiceover gagal.");
      const out = job.output as { assetId: string; durationSec: number | null } | null;
      if (!out?.assetId) return;
      await reloadAssets();
      const item: AudioItem = {
        id: newId("aud"),
        trackId: "trk_narration",
        type: "audio",
        assetId: out.assetId,
        start: placeAt ?? 0,
        duration: Math.max(0.3, out.durationSec ?? 3),
        sourceIn: 0,
        volume: 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        label: "Voiceover",
      };
      store.apply((d) => ({ ...d, items: [...d.items, item] }));
      toast.success("Voiceover ditambahkan ke trek Narasi.");
    },
  });

  // Playback clock.
  const clock = useRef<{ t0: number; at: number } | null>(null);
  useEffect(() => {
    if (!playing) return;
    clock.current = { t0: time, at: performance.now() };
    let raf = 0;
    const tick = () => {
      const c = clock.current!;
      const t = c.t0 + (performance.now() - c.at) / 1000;
      if (t >= duration) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const seek = (t: number) => {
    const v = Math.max(0, Math.min(t, Math.max(duration, 0)));
    setTime(v);
    if (playing) clock.current = { t0: v, at: performance.now() };
  };
  const togglePlay = () => {
    if (!playing && time >= duration - 0.05) setTime(0);
    setPlaying((p) => !p);
  };

  const split = () => {
    if (!selected) return toast.info("Pilih klip untuk dipotong.");
    const parts = splitItem(selected, time);
    if (!parts) return toast.info("Posisikan playhead di dalam klip terpilih.");
    store.apply((d) => ({ ...d, items: d.items.flatMap((i) => (i.id === selected.id ? parts : [i])) }));
    setSelectedId(parts[1].id);
  };
  const remove = () => {
    if (!selected) return;
    store.apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== selected.id) }));
    setSelectedId(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: newId(), start: selected.start + selected.duration };
    store.apply((d) => ({ ...d, items: [...d.items, copy] }));
    setSelectedId(copy.id);
  };

  // Keyboard shortcuts.
  const handlers = useRef({ togglePlay, split, remove, duplicate, undo: store.undo, redo: store.redo });
  useLayoutEffect(() => {
    handlers.current = { togglePlay, split, remove, duplicate, undo: store.undo, redo: store.redo };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      const h = handlers.current;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        h.togglePlay();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        h.redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        h.duplicate();
      } else if (e.key === "Delete" || e.key === "Backspace") h.remove();
      else if (e.key.toLowerCase() === "s" && !mod) h.split();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveTitle = async () => {
    if (!title.trim() || title === project.title) return;
    await api(`/api/projects/${project.id}`, { method: "PATCH", json: { title } }).catch((e) => toast.error((e as Error).message));
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button variant="ghost" size="icon-sm" asChild><Link href="/app/projects" aria-label="Kembali"><ArrowLeft /></Link></Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} className="h-8 max-w-64 border-transparent bg-transparent font-medium hover:border-border" aria-label="Judul proyek" />
        <SaveIndicator state={saveState} />
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Urungkan (Ctrl+Z)"><Button variant="ghost" size="icon-sm" onClick={store.undo} disabled={!store.canUndo}><Undo2 /></Button></Tooltip>
          <Tooltip content="Ulangi (Ctrl+Shift+Z)"><Button variant="ghost" size="icon-sm" onClick={store.redo} disabled={!store.canRedo}><Redo2 /></Button></Tooltip>
          <ExportDialog projectId={project.id} doc={doc} flush={store.flush} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 md:block">
          <LeftPanel
            projectId={project.id}
            store={store}
            assets={assets}
            assetMap={assetMap}
            time={time}
            selected={selected}
            onSelect={setSelectedId}
            reloadAssets={reloadAssets}
            onVoiceJob={(id, at) => setVoiceJobs((v) => ({ ...v, [id]: at }))}
            pendingVoice={Object.keys(voiceJobs).length}
          />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40">
            <Preview doc={doc} assets={assetMap} time={time} playing={playing} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          {/* Transport */}
          <div className="flex h-11 shrink-0 items-center gap-1 border-t border-border px-3">
            <Button variant="ghost" size="icon-sm" onClick={() => seek(0)} aria-label="Ke awal"><SkipBack /></Button>
            <Button variant="ghost" size="icon-sm" onClick={togglePlay} aria-label={playing ? "Jeda" : "Putar"}>{playing ? <Pause /> : <Play />}</Button>
            <span className="w-32 font-mono text-xs tabular-nums text-muted-foreground">{formatTimecode(time)} / {formatTimecode(duration)}</span>
            <div className="mx-2 h-5 w-px bg-border" />
            <Tooltip content="Potong di playhead (S)"><Button variant="ghost" size="icon-sm" onClick={split} disabled={!selected}><Scissors /></Button></Tooltip>
            <Tooltip content="Duplikat (Ctrl+D)"><Button variant="ghost" size="icon-sm" onClick={duplicate} disabled={!selected}><Copy /></Button></Tooltip>
            <Tooltip content="Hapus (Delete)"><Button variant="ghost" size="icon-sm" onClick={remove} disabled={!selected}><Trash2 /></Button></Tooltip>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(5, z / 1.5))} aria-label="Perkecil"><Minus /></Button>
              <span className="w-10 text-center text-[10px] text-muted-foreground">{Math.round(zoom)}px/s</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(300, z * 1.5))} aria-label="Perbesar"><Plus /></Button>
            </div>
          </div>
          <div className="h-60 shrink-0 border-t border-border bg-card/40">
            <TimelinePanel store={store} assets={assetMap} time={time} onSeek={seek} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom} />
          </div>
        </div>
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card/40 scrollbar-thin lg:block">
          <PropertiesPanel store={store} selected={selected} assets={assetMap} />
        </aside>
      </div>
      <p className="border-t border-border px-3 py-1 text-center text-[11px] text-muted-foreground md:hidden">Untuk pengalaman editor lengkap, gunakan layar yang lebih lebar.</p>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: <Check className="size-3.5" />, text: "Tersimpan", cls: "text-muted-foreground" },
    dirty: { icon: <Loader2 className="size-3.5 opacity-0" />, text: "Perubahan belum disimpan", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Menyimpan…", cls: "text-muted-foreground" },
    error: { icon: <CloudOff className="size-3.5" />, text: "Gagal menyimpan, mencoba lagi", cls: "text-destructive" },
    conflict: { icon: <CloudOff className="size-3.5" />, text: "Diubah di tempat lain. Muat ulang halaman.", cls: "text-destructive" },
  }[state];
  return <span className={`hidden items-center gap-1 text-xs sm:flex ${map.cls}`}>{map.icon}{map.text}</span>;
}
