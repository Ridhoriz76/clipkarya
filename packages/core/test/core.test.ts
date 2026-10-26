import { describe, expect, it } from "vitest";
import {
  buildAss,
  captionItemsToCues,
  emptyTimeline,
  estimateAiJobCredits,
  estimateRenderCredits,
  findClipCandidates,
  frameSize,
  hookScore,
  jobInputSchemas,
  parseSubtitles,
  splitItem,
  timelineDuration,
  timelineSchema,
  toSRT,
  toVTT,
  trimItem,
  validateTimeline,
  wordsToCues,
  type Transcript,
} from "../src";
import { buildRenderPlan, parseProgress } from "../src/render";
import { extractJson } from "../src/providers/json";
import { capabilityAvailability, getTranscriptionProvider, providerStatuses } from "../src/providers/registry";

const videoItem = timelineSchema.shape.items.element.parse({
  id: "v1",
  trackId: "trk_video",
  type: "video",
  assetId: "a1",
  start: 2,
  duration: 10,
  sourceIn: 5,
});

describe("timeline", () => {
  it("applies defaults when parsing", () => {
    expect(videoItem.type).toBe("video");
    if (videoItem.type !== "video") throw new Error();
    expect(videoItem.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(videoItem.fit).toBe("cover");
  });

  it("splits a video item and shifts the source offset", () => {
    const parts = splitItem(videoItem, 6);
    expect(parts).not.toBeNull();
    const [l, r] = parts!;
    expect(l.duration).toBe(4);
    expect(r.start).toBe(6);
    expect(r.duration).toBe(6);
    if (r.type !== "video") throw new Error();
    expect(r.sourceIn).toBe(9);
    expect(splitItem(videoItem, 2.01)).toBeNull();
  });

  it("trims the start edge keeping media anchored", () => {
    const t = trimItem(videoItem, "start", 4);
    if (t.type !== "video") throw new Error();
    expect(t.start).toBe(4);
    expect(t.duration).toBe(8);
    expect(t.sourceIn).toBe(7);
    // Extending left consumes earlier source media but never goes below source 0.
    const t2 = trimItem(videoItem, "start", 0);
    if (t2.type !== "video") throw new Error();
    expect(t2.start).toBe(0);
    expect(t2.sourceIn).toBe(3);
    const t3 = trimItem({ ...videoItem, start: 8 } as typeof videoItem, "start", 0);
    if (t3.type !== "video") throw new Error();
    expect(t3.sourceIn).toBe(0);
    expect(t3.start).toBe(3);
  });

  it("caps right trim at source duration", () => {
    const t = trimItem(videoItem, "end", 100, 20);
    expect(t.duration).toBe(15);
  });

  it("validates track references and accepted types", () => {
    const tl = emptyTimeline("9:16", "720p");
    tl.items.push(videoItem, { ...videoItem, id: "bad", trackId: "trk_subtitle" });
    const issues = validateTimeline(tl);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.itemId).toBe("bad");
    expect(timelineDuration(tl)).toBe(12);
  });

  it("computes frame sizes", () => {
    expect(frameSize("9:16", "1080p")).toEqual({ width: 1080, height: 1920 });
    expect(frameSize("16:9", "720p")).toEqual({ width: 1280, height: 720 });
    expect(frameSize("1:1", "720p")).toEqual({ width: 720, height: 720 });
  });
});

describe("subtitles", () => {
  const words = [
    { text: "Halo", start: 0, end: 0.4 },
    { text: "semua,", start: 0.45, end: 0.9 },
    { text: "ini", start: 1, end: 1.2 },
    { text: "tes", start: 1.25, end: 1.6 },
    { text: "subtitle.", start: 1.65, end: 2.2 },
    { text: "Lanjut", start: 4, end: 4.5 },
  ];

  it("groups words into cues respecting gaps and punctuation", () => {
    const cues = wordsToCues(words, 4);
    expect(cues.map((c) => c.text)).toEqual(["Halo semua,", "ini tes subtitle.", "Lanjut"]);
  });

  it("round-trips SRT and VTT", () => {
    const cues = wordsToCues(words, 4);
    const srt = toSRT(cues);
    expect(srt).toContain("00:00:00,000 --> 00:00:00,900");
    expect(parseSubtitles(srt).map((c) => c.text)).toEqual(cues.map((c) => c.text));
    const vtt = toVTT(cues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(parseSubtitles(vtt)[1]!.start).toBeCloseTo(1, 3);
  });

  it("builds ASS with karaoke tags and escapes braces", () => {
    const tl = emptyTimeline("9:16", "1080p");
    const ass = buildAss({
      width: 1080,
      height: 1920,
      style: tl.captionStyle,
      captionsEnabled: true,
      texts: [],
      captions: [
        { id: "c", trackId: "trk_subtitle", type: "caption", start: 0, duration: 2, text: "a {b}", words: [{ text: "a", start: 0, end: 0.5 }, { text: "{b}", start: 0.6, end: 1 }] },
      ],
    });
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toMatch(/\{\\k\d+\}a/);
    expect(ass).toContain("(b)");
    expect(captionItemsToCues([]).length).toBe(0);
  });
});

describe("clip finder", () => {
  const segs = [
    "Eh jadi kita mulai ya.",
    "Kenapa 90% orang gagal diet di minggu pertama?",
    "Jawabannya ternyata sederhana sekali.",
    "Mereka tidak tidur cukup dan stres naik.",
    "Hormon lapar meningkat dan kemauan menurun.",
    "Jadi tips pertama adalah tidur tujuh jam.",
    "Itu saja untuk bagian ini.",
    "Sekarang kita bahas topik lain yang tidak terkait",
  ];
  const transcript: Transcript = {
    language: "id",
    text: segs.join(" "),
    duration: segs.length * 8,
    words: [],
    segments: segs.map((text, i) => ({ start: i * 8, end: i * 8 + 7.5, text })),
  };

  it("scores hooks transparently", () => {
    expect(hookScore("Kenapa 90% orang gagal?").score).toBeGreaterThan(hookScore("Eh jadi kita mulai ya.").score);
  });

  it("returns non-overlapping, explainable candidates within duration bounds", () => {
    const c = findClipCandidates(transcript, { minDuration: 15, maxDuration: 40, targetDuration: 30 });
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) {
      expect(x.duration).toBeGreaterThanOrEqual(15);
      expect(x.duration).toBeLessThanOrEqual(40);
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(100);
      expect(x.reasons.length).toBeGreaterThan(0);
    }
    expect(c[0]!.hookText).toContain("Kenapa");
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) {
        const ov = Math.min(c[i]!.end, c[j]!.end) - Math.max(c[i]!.start, c[j]!.start);
        expect(ov).toBeLessThanOrEqual(0.25 * Math.min(c[i]!.duration, c[j]!.duration));
      }
  });
});

describe("credits & jobs", () => {
  it("estimates costs", () => {
    expect(estimateAiJobCredits("transcription", { assetId: crypto.randomUUID(), diarize: false }, { mediaDurationSec: 125 })).toBe(3);
    expect(estimateAiJobCredits("image", jobInputSchemas.image.parse({ prompt: "kucing lucu", count: 2 }))).toBe(6);
    expect(estimateRenderCredits(61, "1080p")).toBe(4);
  });

  it("rejects invalid job input", () => {
    expect(jobInputSchemas.voice.safeParse({ text: "", voiceId: "x" }).success).toBe(false);
    expect(jobInputSchemas.transcription.safeParse({ assetId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("providers", () => {
  it("never reports a configured provider without keys", () => {
    const st = providerStatuses({});
    expect(st.every((s) => !s.configured)).toBe(true);
    expect(capabilityAvailability({}).transcription.available).toBe(false);
    expect(() => getTranscriptionProvider({})).toThrow(/belum dikonfigurasi/);
  });

  it("labels demo mode explicitly", async () => {
    const p = getTranscriptionProvider({ DEMO_MODE: "true" });
    expect(p.isDemo).toBe(true);
    const { transcript } = await p.transcribe({ audio: new Uint8Array(), filename: "a.mp3", mimeType: "audio/mpeg", durationSec: 30 });
    expect(transcript.text).toContain("[DEMO]");
    expect(capabilityAvailability({ DEMO_MODE: "true" }).transcription.demoOnly).toBe(true);
  });

  it("prefers real providers over demo", () => {
    expect(getTranscriptionProvider({ DEMO_MODE: "true", OPENAI_API_KEY: "sk-test" }).isDemo).toBe(false);
  });

  it("extracts JSON from fenced model output", () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('blah {"b":[1,2]} trailing')).toEqual({ b: [1, 2] });
  });
});

describe("render plan", () => {
  it("builds an H.264/AAC plan with captions, music and correct frame size", () => {
    const tl = emptyTimeline("9:16", "720p");
    tl.items.push(
      videoItem,
      timelineSchema.shape.items.element.parse({ id: "m", trackId: "trk_audio", type: "audio", assetId: "music", start: 0, duration: 12, loop: true }),
    );
    const plan = buildRenderPlan({
      timeline: tl,
      assets: {
        a1: { path: "/tmp/a.mp4", kind: "video", hasAudio: true, duration: 30 },
        music: { path: "/tmp/m.mp3", kind: "audio", hasAudio: true, duration: 5 },
      },
      settings: { resolution: "720p", burnCaptions: true, exportSrt: true, normalizeAudio: true },
      assPath: "/tmp/x:y/c.ass",
      outputPath: "/tmp/out.mp4",
    });
    expect(plan.width).toBe(720);
    expect(plan.height).toBe(1280);
    expect(plan.duration).toBe(12);
    const fc = plan.args[plan.args.indexOf("-filter_complex") + 1]!;
    expect(fc).toContain("amix=inputs=2");
    expect(fc).toContain("ass=filename=/tmp/x\\:y/c.ass");
    expect(plan.args).toContain("libx264");
    expect(plan.args).toContain("-stream_loop");
    expect(parseProgress("out_time_us=6000000\nprogress=continue", 12)).toBeCloseTo(0.5);
  });
});

describe("builders", async () => {
  const { timelineFromClip } = await import("../src/builders");
  it("builds a vertical clip timeline with captions re-timed to zero", () => {
    const tl = timelineFromClip({
      assetId: "00000000-0000-0000-0000-000000000001",
      start: 10,
      end: 20,
      transcript: { segments: [], words: [{ text: "a", start: 9, end: 9.5 }, { text: "halo", start: 10.2, end: 10.6 }, { text: "dunia.", start: 10.7, end: 11.2 }] },
    });
    expect(tl.aspectRatio).toBe("9:16");
    const v = tl.items.find((i) => i.type === "video")!;
    expect(v.duration).toBe(10);
    const caps = tl.items.filter((i) => i.type === "caption");
    expect(caps).toHaveLength(1);
    expect(caps[0]!.start).toBeCloseTo(0.2);
    expect(timelineSchema.safeParse(tl).success).toBe(true);
  });
});

describe("free mode flag", async () => {
  const { isFreeMode, FREE_DAILY_LIMITS } = await import("../src/credits");
  it("is on by default and only off when explicitly 'false'", () => {
    expect(isFreeMode({})).toBe(true);
    expect(isFreeMode({ NEXT_PUBLIC_FREE_MODE: "true" })).toBe(true);
    expect(isFreeMode({ NEXT_PUBLIC_FREE_MODE: " FALSE " })).toBe(false);
  });
  it("caps the costliest features hardest", () => {
    expect(FREE_DAILY_LIMITS.video).toBeLessThan(FREE_DAILY_LIMITS.image);
  });
});
