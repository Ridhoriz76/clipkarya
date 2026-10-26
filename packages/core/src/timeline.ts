import { z } from "zod";
import { ASPECT_RATIOS, RESOLUTIONS } from "./config";

/**
 * Timeline document model shared by the editor (client), the API (validation)
 * and the render worker (FFmpeg graph). All times are seconds.
 * Coordinates for rects/positions are normalized 0..1 relative to the output frame.
 */

export const TRACK_KINDS = ["video", "overlay", "narration", "audio", "subtitle"] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export const CAPTION_POSITIONS = ["top", "middle", "bottom"] as const;
export const CAPTION_FONTS = ["Inter", "DejaVu Sans", "Liberation Sans", "Noto Sans", "Liberation Serif"] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const rect = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.01).max(1),
  h: z.number().min(0.01).max(1),
});
export type Rect = z.infer<typeof rect>;

export const captionStyleSchema = z.object({
  font: z.enum(CAPTION_FONTS).default("Inter"),
  /** Font size in px relative to a 1080px-wide frame; scaled to output. */
  size: z.number().min(16).max(160).default(64),
  color: hexColor.default("#FFFFFF"),
  highlightColor: hexColor.default("#FACC15"),
  outlineColor: hexColor.default("#000000"),
  outlineWidth: z.number().min(0).max(12).default(4),
  background: z.boolean().default(false),
  backgroundColor: hexColor.default("#000000"),
  backgroundOpacity: z.number().min(0).max(1).default(0.6),
  position: z.enum(CAPTION_POSITIONS).default("bottom"),
  bold: z.boolean().default(true),
  uppercase: z.boolean().default(false),
  /** Highlight the spoken word (karaoke) when word timings are available. */
  karaoke: z.boolean().default(true),
  maxWordsPerCaption: z.number().int().min(1).max(12).default(4),
});
export type CaptionStyle = z.infer<typeof captionStyleSchema>;
export const DEFAULT_CAPTION_STYLE: CaptionStyle = captionStyleSchema.parse({});

export const textStyleSchema = z.object({
  font: z.enum(CAPTION_FONTS).default("Inter"),
  size: z.number().min(12).max(200).default(72),
  color: hexColor.default("#FFFFFF"),
  outlineColor: hexColor.default("#000000"),
  outlineWidth: z.number().min(0).max(12).default(3),
  background: z.boolean().default(false),
  backgroundColor: hexColor.default("#000000"),
  bold: z.boolean().default(true),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

export const TRANSITIONS = ["none", "fade"] as const;
export type Transition = (typeof TRANSITIONS)[number];

const baseItem = {
  id: z.string().min(1),
  trackId: z.string().min(1),
  start: z.number().min(0),
  duration: z.number().min(0.05).max(60 * 60 * 3),
};

export const mediaItemSchema = z.object({
  ...baseItem,
  type: z.enum(["video", "image"]),
  assetId: z.string().min(1),
  /** Offset into the source media (seconds). Ignored for images. */
  sourceIn: z.number().min(0).default(0),
  volume: z.number().min(0).max(2).default(1),
  muted: z.boolean().default(false),
  /** Where the clip is placed within the output frame (full frame by default). */
  rect: rect.default({ x: 0, y: 0, w: 1, h: 1 }),
  /** Source crop (normalized to source dimensions) applied before fitting. */
  crop: rect.nullable().default(null),
  fit: z.enum(["cover", "contain"]).default("cover"),
  transitionIn: z.enum(TRANSITIONS).default("none"),
  transitionOut: z.enum(TRANSITIONS).default("none"),
});

export const audioItemSchema = z.object({
  ...baseItem,
  type: z.literal("audio"),
  assetId: z.string().min(1),
  sourceIn: z.number().min(0).default(0),
  volume: z.number().min(0).max(2).default(1),
  muted: z.boolean().default(false),
  fadeIn: z.number().min(0).max(10).default(0),
  fadeOut: z.number().min(0).max(10).default(0),
  loop: z.boolean().default(false),
  label: z.string().max(200).optional(),
});

export const textItemSchema = z.object({
  ...baseItem,
  type: z.literal("text"),
  text: z.string().max(500),
  style: textStyleSchema.default(textStyleSchema.parse({})),
  /** Anchor point (center of the text) in normalized frame coordinates. */
  position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.2 }),
});

export const wordSchema = z.object({ text: z.string(), start: z.number(), end: z.number() });
export type Word = z.infer<typeof wordSchema>;

export const captionItemSchema = z.object({
  ...baseItem,
  type: z.literal("caption"),
  text: z.string().max(1000),
  /** Word timings relative to the timeline (seconds). Optional; enables karaoke. */
  words: z.array(wordSchema).max(200).default([]),
});

export const timelineItemSchema = z.discriminatedUnion("type", [
  mediaItemSchema,
  audioItemSchema,
  textItemSchema,
  captionItemSchema,
]);
export type MediaItem = z.infer<typeof mediaItemSchema>;
export type AudioItem = z.infer<typeof audioItemSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type CaptionItem = z.infer<typeof captionItemSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;

export const trackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(TRACK_KINDS),
  name: z.string().max(80),
  position: z.number().int().min(0),
  muted: z.boolean().default(false),
  hidden: z.boolean().default(false),
  volume: z.number().min(0).max(2).default(1),
  locked: z.boolean().default(false),
});
export type Track = z.infer<typeof trackSchema>;

export const timelineSchema = z.object({
  version: z.literal(1).default(1),
  aspectRatio: z.enum(ASPECT_RATIOS),
  resolution: z.enum(RESOLUTIONS),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]).default(30),
  background: hexColor.default("#000000"),
  captionStyle: captionStyleSchema.default(DEFAULT_CAPTION_STYLE),
  tracks: z.array(trackSchema).max(20),
  items: z.array(timelineItemSchema).max(2000),
});
export type Timeline = z.infer<typeof timelineSchema>;

/** Which item types each track kind may hold. */
export const TRACK_ACCEPTS: Record<TrackKind, TimelineItem["type"][]> = {
  video: ["video", "image"],
  overlay: ["text", "image", "video"],
  narration: ["audio"],
  audio: ["audio"],
  subtitle: ["caption"],
};

export function itemEnd(item: { start: number; duration: number }): number {
  return item.start + item.duration;
}

export function timelineDuration(t: Pick<Timeline, "items">): number {
  return t.items.reduce((max, it) => Math.max(max, itemEnd(it)), 0);
}

export function defaultTracks(): Track[] {
  return [
    { id: "trk_video", kind: "video", name: "Video", position: 0, muted: false, hidden: false, volume: 1, locked: false },
    { id: "trk_overlay", kind: "overlay", name: "Teks & Overlay", position: 1, muted: false, hidden: false, volume: 1, locked: false },
    { id: "trk_narration", kind: "narration", name: "Narasi", position: 2, muted: false, hidden: false, volume: 1, locked: false },
    { id: "trk_audio", kind: "audio", name: "Musik", position: 3, muted: false, hidden: false, volume: 0.35, locked: false },
    { id: "trk_subtitle", kind: "subtitle", name: "Subtitle", position: 4, muted: false, hidden: false, volume: 1, locked: false },
  ];
}

export function emptyTimeline(aspectRatio: Timeline["aspectRatio"], resolution: Timeline["resolution"]): Timeline {
  return {
    version: 1,
    aspectRatio,
    resolution,
    fps: 30,
    background: "#000000",
    captionStyle: DEFAULT_CAPTION_STYLE,
    tracks: defaultTracks(),
    items: [],
  };
}

export type TimelineIssue = { itemId?: string; message: string };

/** Semantic validation beyond the schema: track references, accepted types, overlaps on single-lane tracks. */
export function validateTimeline(t: Timeline): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const tracks = new Map(t.tracks.map((tr) => [tr.id, tr]));
  for (const item of t.items) {
    const track = tracks.get(item.trackId);
    if (!track) {
      issues.push({ itemId: item.id, message: `Item references unknown track ${item.trackId}` });
      continue;
    }
    if (!TRACK_ACCEPTS[track.kind].includes(item.type)) {
      issues.push({ itemId: item.id, message: `Track ${track.kind} cannot hold ${item.type}` });
    }
  }
  const ids = new Set<string>();
  for (const item of t.items) {
    if (ids.has(item.id)) issues.push({ itemId: item.id, message: "Duplicate item id" });
    ids.add(item.id);
  }
  return issues;
}

let idCounter = 0;
export function newId(prefix = "itm"): string {
  idCounter = (idCounter + 1) % 1e6;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

/** Split an item at an absolute timeline time. Returns null when the time is not strictly inside. */
export function splitItem(item: TimelineItem, at: number): [TimelineItem, TimelineItem] | null {
  const minLen = 0.1;
  if (at <= item.start + minLen || at >= itemEnd(item) - minLen) return null;
  const leftDur = at - item.start;
  const left = { ...item, duration: leftDur } as TimelineItem;
  const right = { ...item, id: newId(), start: at, duration: item.duration - leftDur } as TimelineItem;
  if (right.type === "video" || right.type === "audio") {
    right.sourceIn = (item as MediaItem | AudioItem).sourceIn + leftDur;
  }
  if (left.type === "caption" && right.type === "caption") {
    const words = (item as CaptionItem).words;
    left.words = words.filter((w) => w.start < at);
    right.words = words.filter((w) => w.start >= at);
    if (left.words.length && right.words.length) {
      left.text = left.words.map((w) => w.text).join(" ");
      right.text = right.words.map((w) => w.text).join(" ");
    }
  }
  if (left.type === "video" || left.type === "image") left.transitionOut = "none";
  if (right.type === "video" || right.type === "image") right.transitionIn = "none";
  return [left, right];
}

/**
 * Trim an item by moving its left or right edge. Left trims shift sourceIn so the
 * visible media stays anchored in time. sourceDuration (if known) caps right trims.
 */
export function trimItem(
  item: TimelineItem,
  edge: "start" | "end",
  newTime: number,
  sourceDuration?: number,
): TimelineItem {
  const minLen = 0.1;
  if (edge === "start") {
    const end = itemEnd(item);
    let start = Math.min(Math.max(0, newTime), end - minLen);
    if (item.type === "video" || item.type === "audio") {
      const delta = start - item.start;
      const sourceIn = item.sourceIn + delta;
      if (sourceIn < 0) start = item.start - item.sourceIn;
      return { ...item, start, duration: end - start, sourceIn: Math.max(0, sourceIn) };
    }
    return { ...item, start, duration: end - start };
  }
  let duration = Math.max(minLen, newTime - item.start);
  if ((item.type === "video" || item.type === "audio") && sourceDuration !== undefined && !(item.type === "audio" && item.loop)) {
    duration = Math.min(duration, Math.max(minLen, sourceDuration - item.sourceIn));
  }
  return { ...item, duration };
}

/** Sequentially pack items on a track (used for scene reordering on the main video track). */
export function rippleTrack(items: TimelineItem[], trackId: string, order: string[]): TimelineItem[] {
  const onTrack = new Map(items.filter((i) => i.trackId === trackId).map((i) => [i.id, i]));
  let cursor = 0;
  const packed = new Map<string, TimelineItem>();
  for (const id of order) {
    const it = onTrack.get(id);
    if (!it) continue;
    packed.set(id, { ...it, start: cursor });
    cursor += it.duration;
  }
  return items.map((i) => packed.get(i.id) ?? i);
}

export function assetIdsInTimeline(t: Pick<Timeline, "items">): string[] {
  const ids = new Set<string>();
  for (const it of t.items) if ("assetId" in it) ids.add(it.assetId);
  return [...ids];
}
