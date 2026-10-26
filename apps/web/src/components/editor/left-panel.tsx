"use client";
import { useState } from "react";
import {
  captionItemsFromWords,
  newId,
  wordsInRange,
  type AudioItem,
  type MediaItem,
  type Rect,
  type TextItem,
  type Timeline,
  type TimelineItem,
} from "@clipkarya/core";
import { Captions, Columns2, Film, Image as ImageIcon, LayoutPanelTop, Loader2, Mic, Music2, Plus, PictureInPicture2, Rows2, Square, Type, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { VoicePicker, type VoiceChoice } from "@/components/app/voice-picker";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/lib/client-api";
import { formatDuration } from "@/lib/utils";
import { nextFreeStart } from "./timeline";
import type { EditorStore } from "./use-editor-store";
import type { EditorAsset } from "./types";

type Props = {
  projectId: string;
  store: EditorStore;
  assets: EditorAsset[];
  assetMap: Map<string, EditorAsset>;
  time: number;
  selected: TimelineItem | null;
  onSelect: (id: string) => void;
  reloadAssets: () => Promise<void>;
  onVoiceJob: (jobId: string, placeAt: number) => void;
  pendingVoice: number;
};

export function LeftPanel(p: Props) {
  return (
    <Tabs defaultValue="media" className="flex h-full flex-col">
      <TabsList className="m-2 grid h-auto grid-cols-5">
        <TabsTrigger value="media" className="flex-col gap-0.5 px-1 py-1.5 text-[10px]"><Film />Media</TabsTrigger>
        <TabsTrigger value="text" className="flex-col gap-0.5 px-1 py-1.5 text-[10px]"><Type />Teks</TabsTrigger>
        <TabsTrigger value="audio" className="flex-col gap-0.5 px-1 py-1.5 text-[10px]"><Music2 />Audio</TabsTrigger>
        <TabsTrigger value="captions" className="flex-col gap-0.5 px-1 py-1.5 text-[10px]"><Captions />Subtitle</TabsTrigger>
        <TabsTrigger value="layout" className="flex-col gap-0.5 px-1 py-1.5 text-[10px]"><LayoutPanelTop />Layout</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <TabsContent value="media" className="mt-0"><MediaTab {...p} /></TabsContent>
        <TabsContent value="text" className="mt-0"><TextTab {...p} /></TabsContent>
        <TabsContent value="audio" className="mt-0"><AudioTab {...p} /></TabsContent>
        <TabsContent value="captions" className="mt-0"><CaptionsTab {...p} /></TabsContent>
        <TabsContent value="layout" className="mt-0"><LayoutTab {...p} /></TabsContent>
      </div>
    </Tabs>
  );
}

function UploadButton({ projectId, accept, label, onDone }: { projectId: string; accept: string; label: string; onDone: () => Promise<void> }) {
  const { upload, uploads } = useUpload();
  const active = uploads.filter((u) => u.status === "uploading" || u.status === "processing");
  return (
    <div className="space-y-2">
      <Button asChild variant="outline" className="w-full">
        <label className="cursor-pointer">
          <Upload /> {label}
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              for (const f of files) {
                try {
                  await upload(f, projectId);
                } catch (err) {
                  toast.error(`${f.name}: ${(err as Error).message}`);
                }
              }
              await onDone();
              // Probe runs in the worker; refresh again shortly so durations appear.
              setTimeout(() => void onDone(), 4000);
            }}
          />
        </label>
      </Button>
      {active.map((u) => (
        <div key={u.name} className="space-y-1">
          <p className="truncate text-xs text-muted-foreground">{u.name}</p>
          <Progress value={u.progress * 100} />
        </div>
      ))}
    </div>
  );
}

function mediaItem(asset: EditorAsset, trackId: string, start: number, rect?: Rect): MediaItem {
  const isImage = asset.kind === "image";
  return {
    id: newId("vid"),
    trackId,
    type: isImage ? "image" : "video",
    assetId: asset.id,
    start,
    duration: isImage ? 4 : Math.max(0.5, asset.duration_sec ?? 5),
    sourceIn: 0,
    volume: 1,
    muted: false,
    rect: rect ?? { x: 0, y: 0, w: 1, h: 1 },
    crop: null,
    fit: "cover",
    transitionIn: "none",
    transitionOut: "none",
  };
}

function MediaTab({ projectId, store, assets, time, onSelect, reloadAssets }: Props) {
  const visual = assets.filter((a) => a.kind === "video" || a.kind === "image");
  const add = (a: EditorAsset, where: "append" | "playhead" | "overlay") => {
    if (a.status !== "ready") return toast.error("Media masih diproses.");
    const trackId = where === "overlay" ? "trk_overlay" : "trk_video";
    const start = where === "append" ? nextFreeStart(store.doc, "trk_video") : time;
    const item = mediaItem(a, trackId, start, where === "overlay" ? { x: 0.6, y: 0.04, w: 0.36, h: 0.22 } : undefined);
    store.apply((d) => ({ ...d, items: [...d.items, item] }));
    onSelect(item.id);
  };
  return (
    <div className="space-y-3">
      <UploadButton projectId={projectId} accept="video/*,image/png,image/jpeg,image/webp" label="Unggah video/gambar" onDone={reloadAssets} />
      {!visual.length && <p className="text-xs text-muted-foreground">Belum ada media di proyek ini.</p>}
      <div className="grid grid-cols-2 gap-2">
        {visual.map((a) => (
          <div key={a.id} className="group overflow-hidden rounded-lg border border-border bg-card">
            <button className="relative block aspect-video w-full bg-muted" onClick={() => add(a, "append")} title="Tambahkan di akhir timeline">
              {a.thumbnailUrl || (a.kind === "image" && a.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumbnailUrl ?? a.url!} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center">{a.status === "ready" ? (a.kind === "image" ? <ImageIcon className="size-4" /> : <Film className="size-4" />) : <Loader2 className="size-4 animate-spin" />}</span>
              )}
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">{a.kind === "image" ? "IMG" : formatDuration(a.duration_sec)}</span>
              {a.is_demo && <Badge variant="demo" className="absolute left-1 top-1 px-1 py-0 text-[9px]">DEMO</Badge>}
            </button>
            <div className="flex gap-1 p-1">
              <Button size="sm" variant="ghost" className="h-6 flex-1 px-1 text-[10px]" onClick={() => add(a, "playhead")} disabled={a.status !== "ready"}>Di playhead</Button>
              <Button size="sm" variant="ghost" className="h-6 flex-1 px-1 text-[10px]" onClick={() => add(a, "overlay")} disabled={a.status !== "ready"}>Overlay</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextTab({ store, time, onSelect }: Props) {
  const presets: { label: string; text: string; y: number; size: number; background: boolean }[] = [
    { label: "Judul", text: "Judul video", y: 0.15, size: 84, background: false },
    { label: "Subjudul", text: "Teks pendukung", y: 0.25, size: 56, background: false },
    { label: "Label kotak", text: "PENTING", y: 0.5, size: 64, background: true },
    { label: "Ajakan (CTA)", text: "Ikuti untuk tips lainnya", y: 0.82, size: 52, background: true },
  ];
  const add = (p: (typeof presets)[number]) => {
    const item: TextItem = {
      id: newId("txt"),
      trackId: "trk_overlay",
      type: "text",
      text: p.text,
      start: time,
      duration: 3,
      style: { font: "Inter", size: p.size, color: "#FFFFFF", outlineColor: "#000000", outlineWidth: 3, background: p.background, backgroundColor: "#111111", bold: true },
      position: { x: 0.5, y: p.y },
    };
    store.apply((d) => ({ ...d, items: [...d.items, item] }));
    onSelect(item.id);
  };
  return (
    <div className="grid gap-2">
      {presets.map((p) => (
        <button key={p.label} onClick={() => add(p)} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-3 text-left text-sm hover:border-primary/50">
          <span><span className="font-medium">{p.label}</span><span className="block text-xs text-muted-foreground">{p.text}</span></span>
          <Plus className="size-4 text-muted-foreground" />
        </button>
      ))}
      <p className="text-xs text-muted-foreground">Teks ditambahkan di posisi playhead. Edit isi dan gaya di panel kanan.</p>
    </div>
  );
}

function AudioTab({ projectId, store, assets, time, onSelect, reloadAssets, onVoiceJob, pendingVoice }: Props) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<VoiceChoice | null>(null);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const audio = assets.filter((a) => a.kind === "audio");
  const total = Math.max(1, ...store.doc.items.map((i) => i.start + i.duration));

  const addAudio = (a: EditorAsset, track: "trk_narration" | "trk_audio") => {
    if (a.status !== "ready") return toast.error("Audio masih diproses.");
    const isMusic = track === "trk_audio";
    const item: AudioItem = {
      id: newId("aud"),
      trackId: track,
      type: "audio",
      assetId: a.id,
      start: isMusic ? 0 : time,
      duration: isMusic ? total : Math.max(0.5, a.duration_sec ?? 3),
      sourceIn: 0,
      volume: 1,
      muted: false,
      fadeIn: isMusic ? 0.5 : 0,
      fadeOut: isMusic ? 1.5 : 0,
      loop: isMusic,
      label: a.original_name ?? undefined,
    };
    store.apply((d) => ({ ...d, items: [...d.items, item] }));
    onSelect(item.id);
  };

  const generate = async () => {
    if (!voice || !text.trim()) return;
    setBusy(true);
    try {
      const { id, creditsCost } = await api<{ id: string; creditsCost: number }>("/api/jobs", {
        method: "POST",
        json: { type: "voice", projectId, input: { text, voiceId: voice.id, provider: voice.provider, speed, placeAt: time } },
      });
      onVoiceJob(id, time);
      toast.success(`Voiceover sedang dibuat${creditsCost ? ` (${creditsCost} kredit)` : ""}. Akan ditempatkan di ${time.toFixed(1)} dtk.`);
      setText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Mic className="size-4 text-primary" /> Voiceover AI</p>
        <VoicePicker value={voice} onChange={setVoice} />
        {voice?.isDemo && <p className="text-xs text-amber-600 dark:text-amber-400">Mode DEMO: menghasilkan nada placeholder, bukan suara.</p>}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis narasi…" maxLength={5000} className="min-h-24" />
        <div className="space-y-1">
          <div className="flex justify-between text-xs"><span>Kecepatan</span><span className="text-muted-foreground">{speed.toFixed(2)}×</span></div>
          <Slider value={[speed]} min={0.7} max={1.3} step={0.05} onValueChange={([v]) => setSpeed(v!)} />
        </div>
        <Button className="w-full" onClick={generate} disabled={busy || !voice || !text.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Mic />} Buat & tempatkan di playhead
        </Button>
        {pendingVoice > 0 && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> {pendingVoice} voiceover diproses…</p>}
      </section>
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Music2 className="size-4 text-primary" /> Audio & musik</p>
        <UploadButton projectId={projectId} accept="audio/*" label="Unggah audio" onDone={reloadAssets} />
        <p className="text-xs text-muted-foreground">Gunakan hanya musik yang Anda miliki lisensinya. Pustaka musik bawaan belum tersedia.</p>
        {audio.map((a) => (
          <div key={a.id} className="space-y-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs">{a.original_name}</p>
              {a.is_demo && <Badge variant="demo" className="px-1 py-0 text-[9px]">DEMO</Badge>}
              <span className="text-[10px] text-muted-foreground">{formatDuration(a.duration_sec)}</span>
            </div>
            {a.url && <audio src={a.url} controls className="h-7 w-full" preload="none" />}
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => addAudio(a, "trk_narration")}>Ke narasi</Button>
              <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => addAudio(a, "trk_audio")}>Jadikan musik latar</Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

type TranscriptLite = { id: string; asset_id: string; segments: { start: number; end: number; text: string }[]; words: { text: string; start: number; end: number }[]; is_demo: boolean };

function CaptionsTab({ projectId, store }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const videoItems = store.doc.items.filter((i): i is MediaItem => i.type === "video");
  const captionCount = store.doc.items.filter((i) => i.type === "caption").length;

  const generate = async () => {
    setBusy("gen");
    try {
      const ids = [...new Set(videoItems.map((v) => v.assetId))];
      const { transcripts } = await api<{ transcripts: TranscriptLite[] }>(`/api/transcripts?assetIds=${ids.join(",")}`);
      const byAsset = new Map(transcripts.map((t) => [t.asset_id, t]));
      const missing = ids.filter((id) => !byAsset.has(id));
      const captions = videoItems.flatMap((v) => {
        const t = byAsset.get(v.assetId);
        if (!t) return [];
        const words = wordsInRange(t, v.sourceIn, v.sourceIn + v.duration);
        return captionItemsFromWords(words, v.start, store.doc.captionStyle.maxWordsPerCaption);
      });
      if (!captions.length) {
        toast.error(missing.length ? "Video di timeline belum ditranskripsi. Klik 'Transkripsi media' terlebih dahulu." : "Tidak ada ucapan yang terdeteksi pada rentang klip.");
        return;
      }
      store.apply((d) => ({ ...d, items: [...d.items.filter((i) => i.type !== "caption"), ...captions] }));
      toast.success(`${captions.length} baris subtitle dibuat${missing.length ? ` (${missing.length} media belum ditranskripsi)` : ""}.`);
      if (transcripts.some((t) => t.is_demo)) toast.warning("Sebagian subtitle berasal dari transkrip DEMO.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const transcribe = async () => {
    setBusy("tr");
    try {
      const ids = [...new Set(videoItems.map((v) => v.assetId))];
      const { transcripts } = await api<{ transcripts: TranscriptLite[] }>(`/api/transcripts?assetIds=${ids.join(",")}`);
      const todo = ids.filter((id) => !transcripts.some((t) => t.asset_id === id));
      for (const assetId of todo) await api("/api/jobs", { method: "POST", json: { type: "transcription", projectId, input: { assetId } } });
      toast.success(todo.length ? `${todo.length} transkripsi dimulai. Klik 'Buat subtitle' setelah selesai.` : "Semua media sudah ditranskripsi.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addManual = () => {
    const t = store.doc.items.reduce((m, i) => (i.type === "caption" ? Math.max(m, i.start + i.duration) : m), 0);
    store.apply((d) => ({ ...d, items: [...d.items, { id: newId("cap"), trackId: "trk_subtitle", type: "caption", start: t, duration: 2, text: "Subtitle baru", words: [] }] }));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Subtitle dibuat dari transkrip media di timeline, disinkronkan per kata.</p>
      <Button className="w-full" onClick={generate} disabled={!!busy || !videoItems.length}>
        {busy === "gen" ? <Loader2 className="animate-spin" /> : <Captions />} {captionCount ? "Buat ulang subtitle" : "Buat subtitle otomatis"}
      </Button>
      <Button variant="outline" className="w-full" onClick={transcribe} disabled={!!busy || !videoItems.length}>
        {busy === "tr" ? <Loader2 className="animate-spin" /> : <Mic />} Transkripsi media
      </Button>
      <Button variant="ghost" className="w-full" onClick={addManual}><Plus /> Tambah baris manual</Button>
      {captionCount > 0 && (
        <Button variant="ghost" className="w-full text-destructive" onClick={() => store.apply((d) => ({ ...d, items: d.items.filter((i) => i.type !== "caption") }))}>
          Hapus semua subtitle ({captionCount})
        </Button>
      )}
    </div>
  );
}

const LAYOUTS: { key: string; label: string; icon: typeof Square; rect: Rect }[] = [
  { key: "full", label: "Penuh", icon: Square, rect: { x: 0, y: 0, w: 1, h: 1 } },
  { key: "top", label: "Atas", icon: Rows2, rect: { x: 0, y: 0, w: 1, h: 0.5 } },
  { key: "bottom", label: "Bawah", icon: Rows2, rect: { x: 0, y: 0.5, w: 1, h: 0.5 } },
  { key: "left", label: "Kiri", icon: Columns2, rect: { x: 0, y: 0, w: 0.5, h: 1 } },
  { key: "right", label: "Kanan", icon: Columns2, rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  { key: "pip-tr", label: "PiP kanan atas", icon: PictureInPicture2, rect: { x: 0.6, y: 0.04, w: 0.36, h: 0.22 } },
  { key: "pip-bl", label: "PiP kiri bawah", icon: PictureInPicture2, rect: { x: 0.04, y: 0.72, w: 0.36, h: 0.22 } },
];

function LayoutTab({ store, selected }: Props) {
  const isVisual = selected && (selected.type === "video" || selected.type === "image");
  const apply = (rect: Rect) => {
    if (!isVisual) return;
    store.apply((d: Timeline) => ({ ...d, items: d.items.map((i) => (i.id === selected!.id ? { ...i, rect } : i)) }));
  };
  const splitPreset = (a: Rect, b: Rect) => {
    // Apply a two-up layout to the main video clip and the overlay clip active at the selection's time.
    const t = selected?.start ?? 0;
    const at = (track: string) => store.doc.items.find((i) => i.trackId === track && (i.type === "video" || i.type === "image") && t >= i.start && t < i.start + i.duration);
    const main = at("trk_video");
    const over = at("trk_overlay");
    if (!main || !over) return toast.error("Butuh satu klip di trek Video dan satu di trek Overlay pada waktu yang sama.");
    store.apply((d) => ({ ...d, items: d.items.map((i) => (i.id === main.id ? { ...i, rect: a } : i.id === over.id ? { ...i, rect: b } : i)) }));
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Komposisi split-screen</p>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={() => splitPreset(LAYOUTS[1]!.rect, LAYOUTS[2]!.rect)}><Rows2 /> Atas/Bawah</Button>
          <Button variant="outline" size="sm" onClick={() => splitPreset(LAYOUTS[3]!.rect, LAYOUTS[4]!.rect)}><Columns2 /> Kiri/Kanan</Button>
          <Button variant="outline" size="sm" onClick={() => splitPreset(LAYOUTS[0]!.rect, LAYOUTS[5]!.rect)}><PictureInPicture2 /> PiP</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Pilih klip, lalu terapkan. Klip utama di trek Video, klip kedua di trek Overlay (gunakan tombol &quot;Overlay&quot; di tab Media).</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Posisi klip terpilih</p>
        {!isVisual && <p className="text-xs text-muted-foreground">Pilih klip video atau gambar di timeline.</p>}
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((l) => (
            <Button key={l.key} variant="outline" size="sm" disabled={!isVisual} onClick={() => apply(l.rect)} className="justify-start">
              <l.icon /> {l.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border p-3">
        <Label className="text-xs">Tips</Label>
        <p className="mt-1 text-xs text-muted-foreground">Atur volume masing-masing klip di panel kanan, dan crop sumber agar subjek tetap di tengah bingkai.</p>
      </div>
    </div>
  );
}
