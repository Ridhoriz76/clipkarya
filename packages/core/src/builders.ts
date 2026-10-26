import type { AspectRatio, Resolution } from "./config";
import { wordsToCues } from "./subtitles";
import {
  DEFAULT_CAPTION_STYLE,
  emptyTimeline,
  newId,
  type CaptionItem,
  type CaptionStyle,
  type MediaItem,
  type Timeline,
  type Word,
} from "./timeline";
import { wordsInRange, type Transcript } from "./transcript";

/** Caption items from timed words, offset to a timeline start. */
export function captionItemsFromWords(words: Word[], offset: number, maxWords: number, trackId = "trk_subtitle"): CaptionItem[] {
  return wordsToCues(words, maxWords).map((c) => ({
    id: newId("cap"),
    trackId,
    type: "caption" as const,
    start: Math.max(0, c.start + offset),
    duration: Math.max(0.2, c.end - c.start),
    text: c.text,
    words: (c.words ?? []).map((w) => ({ text: w.text, start: w.start + offset, end: w.end + offset })),
  }));
}

/** Build an editable vertical-video timeline from a suggested clip of a source video. */
export function timelineFromClip(opts: {
  assetId: string;
  start: number;
  end: number;
  transcript?: Pick<Transcript, "words" | "segments"> | null;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  captionStyle?: CaptionStyle;
}): Timeline {
  const tl = emptyTimeline(opts.aspectRatio ?? "9:16", opts.resolution ?? "1080p");
  tl.captionStyle = opts.captionStyle ?? DEFAULT_CAPTION_STYLE;
  const duration = Math.max(0.5, opts.end - opts.start);
  const video: MediaItem = {
    id: newId("vid"),
    trackId: "trk_video",
    type: "video",
    assetId: opts.assetId,
    start: 0,
    duration,
    sourceIn: opts.start,
    volume: 1,
    muted: false,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    crop: null,
    fit: "cover",
    transitionIn: "none",
    transitionOut: "none",
  };
  tl.items.push(video);
  if (opts.transcript) {
    const words = wordsInRange(opts.transcript, opts.start, opts.end);
    tl.items.push(...captionItemsFromWords(words, 0, tl.captionStyle.maxWordsPerCaption));
  }
  return tl;
}

/** Append a media asset to the end of the main video track. */
export function appendToVideoTrack(tl: Timeline, assetId: string, kind: "video" | "image", duration: number): Timeline {
  const end = tl.items.filter((i) => i.trackId === "trk_video").reduce((m, i) => Math.max(m, i.start + i.duration), 0);
  const item: MediaItem = {
    id: newId("vid"),
    trackId: "trk_video",
    type: kind,
    assetId,
    start: end,
    duration,
    sourceIn: 0,
    volume: 1,
    muted: false,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    crop: null,
    fit: "cover",
    transitionIn: "none",
    transitionOut: "none",
  };
  return { ...tl, items: [...tl.items, item] };
}

export type SceneInput = {
  narration: string;
  onScreenText: string;
  durationSec: number;
  imageAssetId: string | null;
  videoAssetId: string | null;
  voiceAssetId: string | null;
  voiceDurationSec: number | null;
};

/**
 * Assemble scenes into a timeline: one visual per scene on the video track, the
 * scene's voiceover on the narration track, optional on-screen text, and captions.
 * TTS returns no word timings, so caption words are spread evenly over each scene's
 * narration (approximate; editable in the editor).
 */
export function timelineFromScenes(
  scenes: SceneInput[],
  opts: { aspectRatio: AspectRatio; resolution: Resolution; captionStyle?: CaptionStyle; musicAssetId?: string | null },
): Timeline {
  const tl = emptyTimeline(opts.aspectRatio, opts.resolution);
  tl.captionStyle = opts.captionStyle ?? DEFAULT_CAPTION_STYLE;
  let t = 0;
  for (const s of scenes) {
    const dur = Math.max(1, s.voiceDurationSec ? s.voiceDurationSec + 0.25 : s.durationSec);
    const visual = s.videoAssetId ?? s.imageAssetId;
    if (visual) {
      tl.items.push({
        id: newId("vid"),
        trackId: "trk_video",
        type: s.videoAssetId ? "video" : "image",
        assetId: visual,
        start: t,
        duration: dur,
        sourceIn: 0,
        volume: s.videoAssetId ? 0 : 1,
        muted: !!s.videoAssetId,
        rect: { x: 0, y: 0, w: 1, h: 1 },
        crop: null,
        fit: "cover",
        transitionIn: t === 0 ? "none" : "fade",
        transitionOut: "none",
      });
    }
    if (s.voiceAssetId) {
      tl.items.push({ id: newId("aud"), trackId: "trk_narration", type: "audio", assetId: s.voiceAssetId, start: t, duration: s.voiceDurationSec ?? dur, sourceIn: 0, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, loop: false });
    }
    if (s.onScreenText.trim()) {
      tl.items.push({
        id: newId("txt"),
        trackId: "trk_overlay",
        type: "text",
        text: s.onScreenText.trim(),
        start: t,
        duration: dur,
        style: { font: "Inter", size: 72, color: "#FFFFFF", outlineColor: "#000000", outlineWidth: 3, background: false, backgroundColor: "#000000", bold: true },
        position: { x: 0.5, y: 0.18 },
      });
    }
    const tokens = s.narration.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      const span = (s.voiceDurationSec ?? dur) / tokens.length;
      const words = tokens.map((w, i) => ({ text: w, start: i * span, end: (i + 1) * span - 0.02 }));
      tl.items.push(...captionItemsFromWords(words, t, tl.captionStyle.maxWordsPerCaption));
    }
    t += dur;
  }
  if (opts.musicAssetId && t > 0) {
    tl.items.push({ id: newId("mus"), trackId: "trk_audio", type: "audio", assetId: opts.musicAssetId, start: 0, duration: t, sourceIn: 0, volume: 1, muted: false, fadeIn: 0.5, fadeOut: 1.5, loop: true, label: "Musik" });
  }
  return tl;
}
