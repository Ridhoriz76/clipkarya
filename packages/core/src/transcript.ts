import { z } from "zod";
import { wordSchema, type Word } from "./timeline";

export const transcriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
  speaker: z.string().nullable().optional(),
});
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const transcriptSchema = z.object({
  language: z.string().nullable(),
  text: z.string(),
  segments: z.array(transcriptSegmentSchema),
  words: z.array(wordSchema.extend({ speaker: z.string().nullable().optional() })),
  duration: z.number().nullable(),
});
export type Transcript = z.infer<typeof transcriptSchema>;

const SENTENCE_END = /[.!?…。！？]["')\]]?$/;

export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text.trim());
}

/**
 * Derive segments from words when a provider returns only word timings, or
 * split overly long provider segments at sentence boundaries.
 */
export function segmentsFromWords(words: Word[], maxSegmentSec = 12): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: cur[0]!.start, end: cur[cur.length - 1]!.end, text: cur.map((w) => w.text).join(" ").trim() });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const span = w.end - cur[0]!.start;
    if (endsSentence(w.text) || span >= maxSegmentSec) flush();
  }
  flush();
  return out;
}

/** Words (or approximated words) falling inside [start, end), re-timed relative to `start`. */
export function wordsInRange(t: Pick<Transcript, "words" | "segments">, start: number, end: number): Word[] {
  if (t.words.length) {
    return t.words
      .filter((w) => w.start >= start - 0.05 && w.end <= end + 0.05)
      .map((w) => ({ text: w.text, start: Math.max(0, w.start - start), end: Math.max(0, Math.min(end, w.end) - start) }));
  }
  // Fallback: spread segment words evenly across the segment duration.
  const out: Word[] = [];
  for (const s of t.segments) {
    if (s.end <= start || s.start >= end) continue;
    const tokens = s.text.split(/\s+/).filter(Boolean);
    const step = (s.end - s.start) / Math.max(1, tokens.length);
    tokens.forEach((tok, i) => {
      const ws = s.start + i * step;
      if (ws >= start && ws < end) out.push({ text: tok, start: ws - start, end: Math.min(end, ws + step) - start });
    });
  }
  return out;
}
