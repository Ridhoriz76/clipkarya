import type { Transcript, TranscriptSegment } from "./transcript";
import { endsSentence } from "./transcript";

/**
 * Transparent, heuristic short-clip finder. It proposes windows aligned to
 * transcript sentence boundaries and scores them with explainable signals.
 * Scores are a ranking aid only — they are NOT a prediction of virality.
 */

export type ClipScoreBreakdown = {
  hook: number; // 0..1  opening line grabs attention (question, number, strong cue words)
  completeness: number; // 0..1  starts and ends on sentence boundaries
  pacing: number; // 0..1  speech rate in a comfortable range for short-form
  density: number; // 0..1  share of the window that contains speech (few dead pauses)
  lengthFit: number; // 0..1  closeness to the target duration
  relevance: number | null; // 0..1  optional LLM relevance to the user's focus; null if not evaluated
};

export type ClipCandidate = {
  start: number;
  end: number;
  duration: number;
  text: string;
  hookText: string;
  score: number; // 0..100
  breakdown: ClipScoreBreakdown;
  reasons: string[];
};

export type ClipFinderOptions = {
  minDuration: number;
  maxDuration: number;
  targetDuration: number;
  maxCandidates: number;
};

export const DEFAULT_CLIP_OPTIONS: ClipFinderOptions = {
  minDuration: 15,
  maxDuration: 60,
  targetDuration: 35,
  maxCandidates: 8,
};

export const SCORE_WEIGHTS: Record<keyof Omit<ClipScoreBreakdown, "relevance">, number> & { relevance: number } = {
  hook: 0.3,
  completeness: 0.2,
  pacing: 0.15,
  density: 0.15,
  lengthFit: 0.2,
  relevance: 0.25, // only applied when relevance is evaluated; weights are renormalized
};

// Cue words (Indonesian + English) that commonly open engaging segments.
const HOOK_CUES = [
  "rahasia", "kenapa", "mengapa", "bagaimana", "cara", "jangan", "ternyata", "penting", "kesalahan", "tips", "trik",
  "pertama", "sebenarnya", "faktanya", "bayangkan", "coba", "stop", "wajib", "terbaik", "terburuk", "gila", "serius",
  "secret", "why", "how", "never", "stop", "mistake", "best", "worst", "imagine", "truth", "actually", "here's", "nobody",
  "biggest", "first", "most", "important", "you", "kamu", "anda",
];

const FILLERS = /^(eh+|em+|hmm+|uh+|um+|ya|jadi|nah|oke|ok|so|well|like|anyway)\b[,.]?\s*/i;

export function hookScore(text: string): { score: number; reasons: string[] } {
  const t = text.trim().toLowerCase();
  const reasons: string[] = [];
  let score = 0.25;
  if (/\?/.test(t)) {
    score += 0.3;
    reasons.push("Dibuka dengan pertanyaan");
  }
  if (/\d/.test(t)) {
    score += 0.15;
    reasons.push("Menyebut angka spesifik");
  }
  const cueHits = HOOK_CUES.filter((c) => new RegExp(`(^|\\W)${c}(\\W|$)`).test(t));
  if (cueHits.length) {
    score += Math.min(0.3, 0.12 * cueHits.length);
    reasons.push(`Kata pembuka kuat: ${cueHits.slice(0, 3).join(", ")}`);
  }
  if (FILLERS.test(t)) {
    score -= 0.2;
    reasons.push("Dibuka dengan kata pengisi");
  }
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words > 0 && words <= 14) score += 0.1;
  return { score: clamp01(score), reasons };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function pacingScore(wordsPerSec: number): number {
  // Comfortable short-form narration ~2.2–3.6 words/sec.
  if (wordsPerSec >= 2.2 && wordsPerSec <= 3.6) return 1;
  if (wordsPerSec < 2.2) return clamp01(wordsPerSec / 2.2);
  return clamp01(1 - (wordsPerSec - 3.6) / 2.5);
}

function lengthFitScore(d: number, o: ClipFinderOptions): number {
  const span = Math.max(o.targetDuration - o.minDuration, o.maxDuration - o.targetDuration);
  return clamp01(1 - Math.abs(d - o.targetDuration) / span);
}

export function combineScore(b: ClipScoreBreakdown): number {
  const w = SCORE_WEIGHTS;
  let total = w.hook * b.hook + w.completeness * b.completeness + w.pacing * b.pacing + w.density * b.density + w.lengthFit * b.lengthFit;
  let weightSum = w.hook + w.completeness + w.pacing + w.density + w.lengthFit;
  if (b.relevance !== null) {
    total += w.relevance * b.relevance;
    weightSum += w.relevance;
  }
  return Math.round((total / weightSum) * 100);
}

function speechSeconds(segs: TranscriptSegment[], transcript: Transcript, start: number, end: number): { speech: number; words: number } {
  const words = transcript.words.filter((w) => w.start >= start && w.end <= end);
  if (words.length) {
    // Merge word spans; gaps under 0.35s count as continuous speech.
    let speech = 0;
    let curS = words[0]!.start;
    let curE = words[0]!.end;
    for (const w of words.slice(1)) {
      if (w.start - curE <= 0.35) curE = Math.max(curE, w.end);
      else {
        speech += curE - curS;
        curS = w.start;
        curE = w.end;
      }
    }
    speech += curE - curS;
    return { speech, words: words.length };
  }
  const speech = segs.reduce((acc, s) => acc + (Math.min(end, s.end) - Math.max(start, s.start)), 0);
  const count = segs.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
  return { speech, words: count };
}

export function findClipCandidates(transcript: Transcript, opts: Partial<ClipFinderOptions> = {}): ClipCandidate[] {
  const o = { ...DEFAULT_CLIP_OPTIONS, ...opts };
  const segs = transcript.segments.filter((s) => s.text.trim() && s.end > s.start);
  const raw: ClipCandidate[] = [];

  for (let i = 0; i < segs.length; i++) {
    let text = "";
    for (let j = i; j < segs.length; j++) {
      const first = segs[i]!;
      const last = segs[j]!;
      text = text ? `${text} ${last.text.trim()}` : last.text.trim();
      const start = first.start;
      const end = last.end;
      const d = end - start;
      if (d > o.maxDuration) break;
      if (d < o.minDuration) continue;

      const window = segs.slice(i, j + 1);
      const { speech, words } = speechSeconds(window, transcript, start, end);
      const hook = hookScore(first.text);
      const prev = segs[i - 1];
      const startsClean = !prev || endsSentence(prev.text);
      const endsClean = endsSentence(last.text);
      const completeness = (startsClean ? 0.5 : 0.15) + (endsClean ? 0.5 : 0.1);
      const breakdown: ClipScoreBreakdown = {
        hook: hook.score,
        completeness: clamp01(completeness),
        pacing: pacingScore(words / Math.max(1, d)),
        density: clamp01(speech / d),
        lengthFit: lengthFitScore(d, o),
        relevance: null,
      };
      const reasons = [...hook.reasons];
      if (startsClean && endsClean) reasons.push("Mulai dan berakhir di batas kalimat");
      else if (!endsClean) reasons.push("Berakhir di tengah kalimat");
      if (breakdown.density < 0.7) reasons.push("Banyak jeda tanpa ucapan");
      if (breakdown.pacing === 1) reasons.push("Tempo bicara nyaman untuk video pendek");
      raw.push({
        start: round2(start),
        end: round2(end),
        duration: round2(d),
        text,
        hookText: first.text.trim(),
        score: combineScore(breakdown),
        breakdown,
        reasons,
      });
    }
  }

  // Greedy non-overlapping selection by score.
  raw.sort((a, b) => b.score - a.score || a.start - b.start);
  const picked: ClipCandidate[] = [];
  for (const c of raw) {
    if (picked.length >= o.maxCandidates) break;
    const overlaps = picked.some((p) => Math.min(p.end, c.end) - Math.max(p.start, c.start) > 0.25 * Math.min(p.duration, c.duration));
    if (!overlaps) picked.push(c);
  }
  return picked.sort((a, b) => b.score - a.score);
}

/** Re-score candidates after an optional relevance evaluation (e.g. LLM). */
export function applyRelevance(cands: ClipCandidate[], relevance: (number | null)[]): ClipCandidate[] {
  return cands
    .map((c, i) => {
      const r = relevance[i];
      if (r === null || r === undefined) return c;
      const breakdown = { ...c.breakdown, relevance: clamp01(r) };
      return { ...c, breakdown, score: combineScore(breakdown) };
    })
    .sort((a, b) => b.score - a.score);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
