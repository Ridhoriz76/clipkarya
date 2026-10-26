import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAss, emptyTimeline, timelineSchema, wordsToCues, type CaptionItem, type TextItem } from "@clipkarya/core";
import { buildRenderPlan, parseProgress } from "@clipkarya/core/render";

// The ffmpeg helpers read env() lazily; give them a valid config without touching Supabase.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-not-used";
const { run, probe } = await import("../src/ffmpeg");

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ck-render-"));
  // 16:9 source with a tone, a still image, and two audio files.
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=12", "-f", "lavfi", "-i", "sine=f=440:d=12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(dir, "src.mp4")]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=s=800x800", "-frames:v", "1", path.join(dir, "img.png")]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=f=660:d=3", path.join(dir, "voice.mp3")]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=f=220:d=2", path.join(dir, "music.mp3")]);
}, 60_000);

afterAll(async () => {
  if (!process.env.KEEP_RENDER_OUTPUT) await rm(dir, { recursive: true, force: true });
  else console.info("render output kept in", dir);
});

describe("FFmpeg render pipeline", () => {
  it("renders a 9:16 MP4 (H.264/AAC) reflecting the timeline", async () => {
    const tl = emptyTimeline("9:16", "720p");
    const parse = (o: unknown) => timelineSchema.shape.items.element.parse(o);
    const words = [
      { text: "Halo", start: 0.2, end: 0.6 },
      { text: "ini", start: 0.7, end: 0.9 },
      { text: "tes", start: 1.0, end: 1.3 },
      { text: "render!", start: 1.4, end: 2.0 },
    ];
    const captions: CaptionItem[] = wordsToCues(words, 3).map((c, i) => ({
      id: `cap${i}`, trackId: "trk_subtitle", type: "caption", start: c.start, duration: c.end - c.start, text: c.text, words: c.words ?? [],
    }));
    tl.items.push(
      parse({ id: "v1", trackId: "trk_video", type: "video", assetId: "src", start: 0, duration: 4, sourceIn: 2, transitionOut: "fade" }),
      parse({ id: "v2", trackId: "trk_video", type: "video", assetId: "src", start: 4, duration: 2, sourceIn: 8, crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }),
      parse({ id: "i1", trackId: "trk_video", type: "image", assetId: "img", start: 6, duration: 2, fit: "contain", transitionIn: "fade" }),
      parse({ id: "pip", trackId: "trk_overlay", type: "video", assetId: "src", start: 1, duration: 3, rect: { x: 0.55, y: 0.05, w: 0.4, h: 0.2 }, muted: true }),
      parse({ id: "n1", trackId: "trk_narration", type: "audio", assetId: "voice", start: 0.5, duration: 3 }),
      parse({ id: "m1", trackId: "trk_audio", type: "audio", assetId: "music", start: 0, duration: 8, loop: true, fadeOut: 1 }),
      parse({ id: "t1", trackId: "trk_overlay", type: "text", text: "Judul {Tes}", start: 0, duration: 3 }),
      ...captions,
    );
    const assPath = path.join(dir, "o.ass");
    await writeFile(
      assPath,
      buildAss({ width: 720, height: 1280, captions, texts: tl.items.filter((i): i is TextItem => i.type === "text"), style: tl.captionStyle, captionsEnabled: true }),
    );
    const out = path.join(dir, "out.mp4");
    const plan = buildRenderPlan({
      timeline: tl,
      assets: {
        src: { path: path.join(dir, "src.mp4"), kind: "video", hasAudio: true, duration: 12 },
        img: { path: path.join(dir, "img.png"), kind: "image", hasAudio: false, duration: null },
        voice: { path: path.join(dir, "voice.mp3"), kind: "audio", hasAudio: true, duration: 3 },
        music: { path: path.join(dir, "music.mp3"), kind: "audio", hasAudio: true, duration: 2 },
      },
      settings: { resolution: "720p", burnCaptions: true, exportSrt: true, normalizeAudio: true },
      assPath,
      outputPath: out,
    });
    let last = 0;
    let buf = "";
    await run("ffmpeg", plan.args, {
      onStdout: (c) => {
        buf = (buf + c).slice(-4000);
        last = parseProgress(buf, plan.duration) ?? last;
      },
    });
    const meta = await probe(out);
    expect(meta.width).toBe(720);
    expect(meta.height).toBe(1280);
    expect(meta.videoCodec).toBe("h264");
    expect(meta.audioCodec).toBe("aac");
    expect(meta.durationSec).toBeGreaterThan(7.8);
    expect(meta.durationSec).toBeLessThan(8.3);
    expect(last).toBeGreaterThan(0.9);

    // Frame at t=7s should show the contained image (letterboxed: top rows black).
    const frame = path.join(dir, "f.png");
    await run("ffmpeg", ["-y", "-ss", "7", "-i", out, "-frames:v", "1", "-vf", "crop=720:40:0:0,scale=1:1", "-f", "rawvideo", "-pix_fmt", "gray", frame]);
    const { readFile } = await import("node:fs/promises");
    const topLuma = (await readFile(frame))[0]!;
    expect(topLuma).toBeLessThan(30);
  }, 120_000);

  it("renders silence when the timeline has no audio", async () => {
    const tl = emptyTimeline("1:1", "720p");
    tl.items.push(timelineSchema.shape.items.element.parse({ id: "i", trackId: "trk_video", type: "image", assetId: "img", start: 0, duration: 1.5 }));
    const out = path.join(dir, "silent.mp4");
    const plan = buildRenderPlan({
      timeline: tl,
      assets: { img: { path: path.join(dir, "img.png"), kind: "image", hasAudio: false, duration: null } },
      settings: { resolution: "720p", burnCaptions: false, exportSrt: false, normalizeAudio: true },
      assPath: null,
      outputPath: out,
    });
    await run("ffmpeg", plan.args);
    const meta = await probe(out);
    expect(meta.width).toBe(720);
    expect(meta.height).toBe(720);
    expect(meta.hasAudio).toBe(true);
  }, 60_000);
});
