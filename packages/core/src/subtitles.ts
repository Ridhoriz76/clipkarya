import type { CaptionItem, CaptionStyle, TextItem, Word } from "./timeline";

export type Cue = { start: number; end: number; text: string; words?: Word[] };

/** Group timed words into short caption cues suitable for vertical video. */
export function wordsToCues(words: Word[], maxWords = 4, maxGapSec = 0.8, maxCueSec = 3.5): Cue[] {
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({
      start: cur[0]!.start,
      end: cur[cur.length - 1]!.end,
      text: cur.map((w) => w.text).join(" "),
      words: cur,
    });
    cur = [];
  };
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && (w.start - last.end > maxGapSec || w.end - cur[0]!.start > maxCueSec || cur.length >= maxWords)) flush();
    cur.push(w);
    if (/[.!?…,;:]$/.test(w.text) && cur.length >= Math.ceil(maxWords / 2)) flush();
  }
  flush();
  // Ensure cues never overlap and have a sane minimum duration.
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    const next = cues[i + 1];
    if (c.end - c.start < 0.3) c.end = c.start + 0.3;
    if (next && c.end > next.start) c.end = next.start;
  }
  return cues;
}

function pad(n: number, len = 2): string {
  return String(Math.floor(n)).padStart(len, "0");
}

export function formatTimestamp(sec: number, sep: "," | "." = ","): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

export function toSRT(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${c.text.trim()}\n`)
      .join("\n")
      .trim() + "\n"
  );
}

export function toVTT(cues: Cue[]): string {
  return (
    "WEBVTT\n\n" +
    cues.map((c) => `${formatTimestamp(c.start, ".")} --> ${formatTimestamp(c.end, ".")}\n${c.text.trim()}\n`).join("\n")
  );
}

function parseTs(ts: string): number {
  const m = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!m) return NaN;
  const [, h, mm, ss, ms] = m;
  return Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms!.padEnd(3, "0")) / 1000;
}

/** Parse SRT or VTT text into cues. */
export function parseSubtitles(input: string): Cue[] {
  const blocks = input.replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n/, "").split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx < 0) continue;
    const [a, b] = lines[idx]!.split("-->");
    const start = parseTs(a ?? "");
    const end = parseTs((b ?? "").trim().split(/\s+/)[0] ?? "");
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    cues.push({ start, end, text: lines.slice(idx + 1).join("\n") });
  }
  return cues;
}

export function captionItemsToCues(items: CaptionItem[]): Cue[] {
  return [...items]
    .sort((a, b) => a.start - b.start)
    .map((i) => ({ start: i.start, end: i.start + i.duration, text: i.text, words: i.words }));
}

// ---------------------------------------------------------------------------
// ASS (Advanced SubStation Alpha) generation for burned-in captions and text.
// ---------------------------------------------------------------------------

/** #RRGGBB + opacity → ASS &HAABBGGRR (alpha 00 = opaque). */
export function assColor(hex: string, opacity = 1): string {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  const a = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}

export function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, "\\N");
}

const ALIGN = { bottom: 2, middle: 5, top: 8 } as const;

export function buildAss(opts: {
  width: number;
  height: number;
  captions: CaptionItem[];
  texts: TextItem[];
  style: CaptionStyle;
  captionsEnabled: boolean;
}): string {
  const { width, height, style } = opts;
  const scale = width / 1080;
  const capSize = Math.round(style.size * scale);
  const marginV = Math.round((style.position === "middle" ? 0 : height * 0.12));
  const capBorderStyle = style.background ? 3 : 1;
  const karaoke = style.karaoke;
  // In ASS karaoke, Secondary is the colour before a syllable is sung, Primary after.
  const primary = karaoke ? assColor(style.highlightColor) : assColor(style.color);
  const secondary = assColor(style.color);
  const back = style.background ? assColor(style.backgroundColor, style.backgroundOpacity) : assColor("#000000", 0.5);
  const outline = style.background ? back : assColor(style.outlineColor);

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${style.font},${capSize},${primary},${secondary},${outline},${back},${style.bold ? -1 : 0},0,0,0,100,100,0,0,${capBorderStyle},${style.background ? Math.max(4, Math.round(10 * scale)) : Math.round(style.outlineWidth * scale)},0,${ALIGN[style.position]},${Math.round(60 * scale)},${Math.round(60 * scale)},${marginV},1`,
    "Style: Text,Inter,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,5,20,20,20,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const t of [...opts.texts].sort((a, b) => a.start - b.start)) {
    if (!t.text.trim()) continue;
    const s = t.style;
    const x = Math.round(t.position.x * width);
    const y = Math.round(t.position.y * height);
    const tags = [
      `\\an5`,
      `\\pos(${x},${y})`,
      `\\fn${s.font}`,
      `\\fs${Math.round(s.size * scale)}`,
      `\\b${s.bold ? 1 : 0}`,
      `\\1c${assColor(s.color).slice(0, 2)}${assColor(s.color).slice(4)}&`,
      `\\3c${assColor(s.background ? s.backgroundColor : s.outlineColor).slice(0, 2)}${assColor(s.background ? s.backgroundColor : s.outlineColor).slice(4)}&`,
      `\\bord${s.background ? Math.round(12 * scale) : Math.round(s.outlineWidth * scale)}`,
    ].join("");
    // BorderStyle 3 (opaque box) can't be set per-event; emulate a box with a thick border of the bg colour.
    lines.push(`Dialogue: 2,${assTime(t.start)},${assTime(t.start + t.duration)},Text,,0,0,0,,{${tags}}${escapeAssText(t.text)}`);
  }

  if (opts.captionsEnabled) {
    for (const c of [...opts.captions].sort((a, b) => a.start - b.start)) {
      const text = style.uppercase ? c.text.toUpperCase() : c.text;
      if (!text.trim()) continue;
      let body: string;
      if (karaoke && c.words.length) {
        // \k durations are centiseconds; include gaps by padding the preceding word.
        const parts: string[] = [];
        let cursor = c.start;
        c.words.forEach((w, i) => {
          const next = c.words[i + 1];
          const wEnd = next ? next.start : c.start + c.duration;
          const lead = Math.max(0, w.start - cursor);
          const dur = Math.max(1, Math.round((wEnd - w.start + lead) * 100));
          const word = style.uppercase ? w.text.toUpperCase() : w.text;
          parts.push(`{\\k${dur}}${escapeAssText(word)}`);
          cursor = wEnd;
        });
        body = parts.join(" ");
      } else {
        body = escapeAssText(text);
      }
      lines.push(`Dialogue: 1,${assTime(c.start)},${assTime(c.start + c.duration)},Caption,,0,0,0,,${body}`);
    }
  }
  return lines.join("\n") + "\n";
}
