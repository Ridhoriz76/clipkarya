"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { frameSize, type AudioItem, type CaptionItem, type MediaItem, type TextItem, type Timeline, type Track } from "@clipkarya/core";
import type { EditorAsset } from "./types";

const FADE = 0.5;

/**
 * Live preview that composites the timeline with DOM media elements. It mirrors the
 * render pipeline's geometry (rect placement, crop, cover/contain, fades) and caption
 * styling so what you see matches the exported MP4 closely.
 */
export function Preview({
  doc,
  assets,
  time,
  playing,
  selectedId,
  onSelect,
}: {
  doc: Timeline;
  assets: Map<string, EditorAsset>;
  time: number;
  playing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frame = frameSize(doc.aspectRatio, doc.resolution);
  const tracks = useMemo(() => new Map<string, Track>(doc.tracks.map((t) => [t.id, t])), [doc.tracks]);

  useLayoutEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pw = el.clientWidth - 32;
      const ph = el.clientHeight - 32;
      const s = Math.min(pw / frame.width, ph / frame.height);
      setSize({ w: Math.max(0, frame.width * s), h: Math.max(0, frame.height * s) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.width, frame.height]);

  const scale = size.w / frame.width;
  const fontScale = size.w / 1080;
  const visual = doc.items
    .filter((i): i is MediaItem => (i.type === "video" || i.type === "image") && !tracks.get(i.trackId)?.hidden)
    .sort((a, b) => (tracks.get(a.trackId)?.position ?? 0) - (tracks.get(b.trackId)?.position ?? 0));
  const audio = doc.items.filter((i): i is AudioItem => i.type === "audio");
  const texts = doc.items.filter((i): i is TextItem => i.type === "text" && !tracks.get(i.trackId)?.hidden && time >= i.start && time < i.start + i.duration);
  const caption = doc.items.find(
    (i): i is CaptionItem => i.type === "caption" && !tracks.get(i.trackId)?.hidden && time >= i.start && time < i.start + i.duration,
  );

  return (
    <div ref={box} className="relative overflow-hidden shadow-2xl" style={{ width: size.w, height: size.h, background: doc.background }} onClick={() => onSelect(null)}>
      {visual.map((it) => (
        <VisualLayer
          key={it.id}
          item={it}
          asset={assets.get(it.assetId)}
          track={tracks.get(it.trackId)}
          time={time}
          playing={playing}
          scale={scale}
          frame={frame}
          selected={selectedId === it.id}
          onSelect={onSelect}
        />
      ))}
      {audio.map((it) => (
        <AudioLayer key={it.id} item={it} asset={assets.get(it.assetId)} track={tracks.get(it.trackId)} time={time} playing={playing} />
      ))}
      {texts.map((t) => (
        <div
          key={t.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer whitespace-pre-wrap text-center ${selectedId === t.id ? "outline outline-2 outline-primary" : ""}`}
          style={{
            left: `${t.position.x * 100}%`,
            top: `${t.position.y * 100}%`,
            maxWidth: "92%",
            fontFamily: `"${t.style.font}", Inter, sans-serif`,
            fontSize: t.style.size * fontScale,
            fontWeight: t.style.bold ? 800 : 400,
            color: t.style.color,
            lineHeight: 1.15,
            padding: t.style.background ? `${4 * fontScale}px ${10 * fontScale}px` : undefined,
            background: t.style.background ? t.style.backgroundColor : undefined,
            textShadow: t.style.background ? undefined : outline(t.style.outlineColor, t.style.outlineWidth * fontScale),
          }}
        >
          {t.text}
        </div>
      ))}
      {caption && <CaptionOverlay item={caption} doc={doc} time={time} fontScale={fontScale} height={size.h} selected={selectedId === caption.id} onSelect={onSelect} />}
    </div>
  );
}

function outline(color: string, w: number): string {
  if (w <= 0) return "none";
  const d = Math.max(1, w);
  return [`${d}px 0`, `-${d}px 0`, `0 ${d}px`, `0 -${d}px`, `${d}px ${d}px`, `-${d}px -${d}px`, `${d}px -${d}px`, `-${d}px ${d}px`].map((o) => `${o} 0 ${color}`).join(",");
}

function CaptionOverlay({ item, doc, time, fontScale, height, selected, onSelect }: { item: CaptionItem; doc: Timeline; time: number; fontScale: number; height: number; selected: boolean; onSelect: (id: string) => void }) {
  const s = doc.captionStyle;
  const pos = s.position === "top" ? { top: height * 0.12 } : s.position === "middle" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: height * 0.12 };
  const words = item.words.length ? item.words : null;
  const text = (w: string) => (s.uppercase ? w.toUpperCase() : w);
  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center px-[6%]" style={pos}>
      <p
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
        className={`pointer-events-auto cursor-pointer text-center ${selected ? "outline outline-2 outline-primary" : ""}`}
        style={{
          fontFamily: `"${s.font}", Inter, sans-serif`,
          fontSize: s.size * fontScale,
          fontWeight: s.bold ? 800 : 500,
          lineHeight: 1.2,
          color: s.color,
          background: s.background ? hexA(s.backgroundColor, s.backgroundOpacity) : undefined,
          padding: s.background ? `${4 * fontScale}px ${10 * fontScale}px` : undefined,
          borderRadius: s.background ? 6 * fontScale : undefined,
          textShadow: s.background ? undefined : outline(s.outlineColor, s.outlineWidth * fontScale),
        }}
      >
        {words && s.karaoke
          ? words.map((w, i) => (
              <span key={i} style={{ color: time >= w.start ? s.highlightColor : s.color }}>
                {text(w.text)}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))
          : text(item.text)}
      </p>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* eslint-disable react-hooks/immutability -- media elements are external DOM objects, held in state via callback refs so effects re-run on mount. */
function useMediaSync(
  el: HTMLMediaElement | null,
  opts: { active: boolean; playing: boolean; mediaTime: number; volume: number; muted: boolean },
) {
  const { active, playing, mediaTime, volume, muted } = opts;
  useEffect(() => {
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume));
    el.muted = muted;
  }, [el, volume, muted]);
  useEffect(() => {
    if (!el) return;
    if (!active) {
      if (!el.paused) el.pause();
      return;
    }
    const drift = Math.abs(el.currentTime - mediaTime);
    if (!playing) {
      if (!el.paused) el.pause();
      if (drift > 0.04) el.currentTime = mediaTime;
    } else {
      if (drift > 0.3) el.currentTime = mediaTime;
      if (el.paused) void el.play().catch(() => undefined);
    }
  }, [el, active, playing, mediaTime]);
}

function VisualLayer({
  item,
  asset,
  track,
  time,
  playing,
  scale,
  frame,
  selected,
  onSelect,
}: {
  item: MediaItem;
  asset: EditorAsset | undefined;
  track: Track | undefined;
  time: number;
  playing: boolean;
  scale: number;
  frame: { width: number; height: number };
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [el, setEl] = useState<HTMLVideoElement | null>(null);
  const active = time >= item.start && time < item.start + item.duration;
  const local = time - item.start;
  useMediaSync(item.type === "video" ? el : null, {
    active,
    playing,
    mediaTime: item.sourceIn + Math.max(0, local),
    volume: item.volume * (track?.volume ?? 1),
    muted: item.muted || !!track?.muted,
  });

  const rw = item.rect.w * frame.width * scale;
  const rh = item.rect.h * frame.height * scale;
  const srcW = asset?.width ?? 1920;
  const srcH = asset?.height ?? 1080;
  const c = item.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cw = srcW * c.w;
  const ch = srcH * c.h;
  const s = item.fit === "cover" ? Math.max(rw / cw, rh / ch) : Math.min(rw / cw, rh / ch);
  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    width: srcW * s,
    height: srcH * s,
    left: -srcW * c.x * s + (rw - cw * s) / 2,
    top: -srcH * c.y * s + (rh - ch * s) / 2,
    maxWidth: "none",
  };
  let opacity = 1;
  if (item.transitionIn === "fade") opacity = Math.min(opacity, Math.max(0, local / Math.min(FADE, item.duration / 2)));
  if (item.transitionOut === "fade") opacity = Math.min(opacity, Math.max(0, (item.duration - local) / Math.min(FADE, item.duration / 2)));

  return (
    <div
      className={`absolute overflow-hidden ${selected ? "outline outline-2 outline-primary" : ""}`}
      style={{
        left: item.rect.x * frame.width * scale,
        top: item.rect.y * frame.height * scale,
        width: rw,
        height: rh,
        visibility: active ? "visible" : "hidden",
        opacity,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      {asset?.url ? (
        item.type === "video" ? (
          <video ref={setEl} src={asset.url} preload="auto" playsInline style={mediaStyle} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt="" style={mediaStyle} draggable={false} />
        )
      ) : (
        <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">Media tidak tersedia</div>
      )}
    </div>
  );
}

function AudioLayer({ item, asset, track, time, playing }: { item: AudioItem; asset: EditorAsset | undefined; track: Track | undefined; time: number; playing: boolean }) {
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const active = time >= item.start && time < item.start + item.duration;
  const local = Math.max(0, time - item.start);
  const srcDur = asset?.duration_sec ?? Infinity;
  const mediaTime = item.loop && Number.isFinite(srcDur) && srcDur > 0 ? (item.sourceIn + local) % srcDur : item.sourceIn + local;
  let fade = 1;
  if (item.fadeIn > 0) fade = Math.min(fade, local / item.fadeIn);
  if (item.fadeOut > 0) fade = Math.min(fade, (item.duration - local) / item.fadeOut);
  useMediaSync(el, { active, playing, mediaTime, volume: item.volume * (track?.volume ?? 1) * Math.max(0, Math.min(1, fade)), muted: item.muted || !!track?.muted });
  useEffect(() => {
    if (el) el.loop = item.loop;
  }, [el, item.loop]);
  return asset?.url ? <audio ref={setEl} src={asset.url} preload="auto" /> : null;
}
/* eslint-enable react-hooks/immutability */
