"use client";
import { useMemo, useRef } from "react";
import { Captions, Eye, EyeOff, Film, Layers, Mic, Music2, Volume2, VolumeX } from "lucide-react";
import { itemEnd, timelineDuration, trimItem, TRACK_ACCEPTS, type Timeline, type TimelineItem, type Track, type TrackKind } from "@clipkarya/core";
import { cn, formatTimecode } from "@/lib/utils";
import type { EditorStore } from "./use-editor-store";
import type { EditorAsset } from "./types";

const TRACK_ICON: Record<TrackKind, typeof Film> = { video: Film, overlay: Layers, narration: Mic, audio: Music2, subtitle: Captions };
const ITEM_COLOR: Record<TimelineItem["type"], string> = {
  video: "bg-sky-600/80 border-sky-400/60",
  image: "bg-indigo-600/80 border-indigo-400/60",
  audio: "bg-emerald-600/70 border-emerald-400/60",
  text: "bg-violet-600/75 border-violet-400/60",
  caption: "bg-primary/70 border-primary",
};
const HEADER_W = 132;
const ROW_H = 44;
const SNAP_PX = 8;

export function TimelinePanel({
  store,
  assets,
  time,
  onSeek,
  selectedId,
  onSelect,
  zoom,
}: {
  store: EditorStore;
  assets: Map<string, EditorAsset>;
  time: number;
  onSeek: (t: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
}) {
  const { doc } = store;
  const scroller = useRef<HTMLDivElement>(null);
  const tracks = useMemo(() => [...doc.tracks].sort((a, b) => a.position - b.position), [doc.tracks]);
  const duration = timelineDuration(doc);
  const width = Math.max(duration + 10, 30) * zoom;

  const timeFromClientX = (clientX: number) => {
    const el = scroller.current!;
    const rect = el.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - HEADER_W + el.scrollLeft) / zoom);
  };

  const scrub = (e: React.PointerEvent) => {
    const move = (ev: PointerEvent) => onSeek(timeFromClientX(ev.clientX));
    onSeek(timeFromClientX(e.clientX));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", move), { once: true });
  };

  const snapTargets = (exclude: string) => [0, time, ...doc.items.filter((i) => i.id !== exclude).flatMap((i) => [i.start, itemEnd(i)])];
  const snap = (t: number, exclude: string) => {
    let best = t;
    let bestD = SNAP_PX / zoom;
    for (const s of snapTargets(exclude)) {
      const d = Math.abs(s - t);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  };

  const startDrag = (e: React.PointerEvent, item: TimelineItem, mode: "move" | "start" | "end") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    const track = doc.tracks.find((t) => t.id === item.trackId);
    if (track?.locked) return;
    store.checkpoint();
    const x0 = e.clientX;
    const orig = item;
    const srcDur = "assetId" in item ? (assets.get(item.assetId)?.duration_sec ?? undefined) : undefined;
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - x0) / zoom;
      store.apply(
        (d) => ({
          ...d,
          items: d.items.map((it) => {
            if (it.id !== orig.id) return it;
            if (mode === "move") {
              const rawStart = Math.max(0, orig.start + dt);
              let start = snap(rawStart, orig.id);
              const endSnap = snap(rawStart + orig.duration, orig.id);
              if (Math.abs(endSnap - (rawStart + orig.duration)) < Math.abs(start - rawStart)) start = endSnap - orig.duration;
              // Vertical move to a compatible track under the pointer.
              const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-track-id]")?.dataset.trackId;
              const tTrack = target ? d.tracks.find((t) => t.id === target) : undefined;
              const trackId = tTrack && !tTrack.locked && TRACK_ACCEPTS[tTrack.kind].includes(orig.type) ? tTrack.id : it.trackId;
              return { ...it, start: Math.max(0, start), trackId };
            }
            const edgeT = snap(mode === "start" ? orig.start + dt : itemEnd(orig) + dt, orig.id);
            return trimItem(orig, mode, edgeT, srcDur);
          }),
        }),
        { record: false },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const patchTrack = (id: string, patch: Partial<Track>) =>
    store.apply((d) => ({ ...d, tracks: d.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  const ticks = useMemo(() => {
    const step = zoom >= 80 ? 1 : zoom >= 30 ? 2 : zoom >= 15 ? 5 : 10;
    const out: number[] = [];
    for (let t = 0; t <= width / zoom; t += step) out.push(t);
    return out;
  }, [zoom, width]);

  return (
    <div ref={scroller} className="relative h-full overflow-auto scrollbar-thin select-none" onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}>
      <div style={{ width: width + HEADER_W }} className="relative min-h-full">
        {/* Ruler */}
        <div className="sticky top-0 z-20 flex h-7 border-b border-border bg-card">
          <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card" style={{ width: HEADER_W }} />
          <div className="relative flex-1 cursor-col-resize" onPointerDown={scrub}>
            {ticks.map((t) => (
              <div key={t} className="absolute top-0 h-full border-l border-border/70 pl-1 text-[10px] text-muted-foreground" style={{ left: t * zoom }}>
                {formatTimecode(t).replace(/\.\d$/, "")}
              </div>
            ))}
          </div>
        </div>

        {tracks.map((track) => {
          const Icon = TRACK_ICON[track.kind];
          const items = doc.items.filter((i) => i.trackId === track.id);
          return (
            <div key={track.id} className="flex border-b border-border/60" style={{ height: ROW_H }}>
              <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-border bg-card px-2 text-xs" style={{ width: HEADER_W }}>
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{track.name}</span>
                {track.kind !== "subtitle" && track.kind !== "overlay" ? (
                  <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => patchTrack(track.id, { muted: !track.muted })} aria-label={track.muted ? "Bunyikan trek" : "Bisukan trek"}>
                    {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                  </button>
                ) : null}
                {track.kind !== "narration" && track.kind !== "audio" ? (
                  <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => patchTrack(track.id, { hidden: !track.hidden })} aria-label={track.hidden ? "Tampilkan trek" : "Sembunyikan trek"}>
                    {track.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                ) : null}
              </div>
              <div data-track-id={track.id} className={cn("relative flex-1", track.hidden && "opacity-40")} onPointerDown={(e) => e.target === e.currentTarget && (onSelect(null), onSeek(timeFromClientX(e.clientX)))}>
                {items.map((it) => (
                  <ItemBlock key={it.id} item={it} zoom={zoom} selected={selectedId === it.id} label={labelFor(it, assets)} onPointerDown={startDrag} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-primary" style={{ left: HEADER_W + time * zoom }}>
          <div className="-ml-1.5 h-2.5 w-3 rounded-b-sm bg-primary" />
        </div>
      </div>
    </div>
  );
}

function labelFor(it: TimelineItem, assets: Map<string, EditorAsset>): string {
  if (it.type === "text" || it.type === "caption") return it.text;
  if (it.type === "audio" && it.label) return it.label;
  return assets.get(it.assetId)?.original_name ?? it.type;
}

function ItemBlock({
  item,
  zoom,
  selected,
  label,
  onPointerDown,
}: {
  item: TimelineItem;
  zoom: number;
  selected: boolean;
  label: string;
  onPointerDown: (e: React.PointerEvent, item: TimelineItem, mode: "move" | "start" | "end") => void;
}) {
  const w = Math.max(4, item.duration * zoom);
  return (
    <div
      className={cn(
        "group absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md border text-[11px] text-white active:cursor-grabbing",
        ITEM_COLOR[item.type],
        selected && "ring-2 ring-white",
      )}
      style={{ left: item.start * zoom, width: w }}
      onPointerDown={(e) => onPointerDown(e, item, "move")}
      title={label}
    >
      <span className="pointer-events-none block truncate px-2 pt-1 leading-tight">{label}</span>
      {"muted" in item && item.muted && <span className="pointer-events-none absolute bottom-0.5 right-1.5 text-[9px] opacity-80">bisu</span>}
      <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40" onPointerDown={(e) => onPointerDown(e, item, "start")} />
      <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40" onPointerDown={(e) => onPointerDown(e, item, "end")} />
    </div>
  );
}

export function nextFreeStart(doc: Timeline, trackId: string): number {
  return doc.items.filter((i) => i.trackId === trackId).reduce((m, i) => Math.max(m, itemEnd(i)), 0);
}
