import { z } from "zod";

/** LLM prompt + response schemas for script/story/listicle generation and clip relevance. */

export const sceneSchema = z.object({
  title: z.string(),
  narration: z.string(),
  visual: z.string(),
  durationSec: z.number().min(1).max(60),
  onScreenText: z.string().optional().default(""),
  /** For listicles: a claim the user should verify, if any. */
  needsVerification: z.boolean().optional().default(false),
});

export const scriptResultSchema = z.object({
  title: z.string(),
  hook: z.string(),
  scenes: z.array(sceneSchema).min(1).max(20),
  ending: z.string(),
  hashtags: z.array(z.string()).max(15).default([]),
});
export type ScriptResult = z.infer<typeof scriptResultSchema>;

export function scriptSystemPrompt(): string {
  return [
    "You are a short-form video scriptwriter for TikTok, Reels and YouTube Shorts.",
    "Write natural, spoken narration. Keep each scene 3–8 seconds of narration.",
    "Never invent statistics, rankings, quotes or facts. If a claim needs evidence that was not provided, phrase it as an opinion or mark needsVerification=true.",
    'Return JSON: {"title","hook","scenes":[{"title","narration","visual","durationSec","onScreenText","needsVerification"}],"ending","hashtags"}.',
    "The first scene's narration must be the hook. 'visual' is a concrete description for an image/video generator (no text in image).",
  ].join("\n");
}

export function scriptUserPrompt(i: {
  topic: string;
  audience?: string;
  language: string;
  durationSec: number;
  tone: string;
  niche?: string;
  format: "script" | "story" | "listicle";
  itemCount?: number;
  criteria?: string;
  reference?: string;
}): string {
  const lines = [
    `Format: ${i.format === "story" ? "faceless storytelling with a hook, rising tension and an ending" : i.format === "listicle" ? `ranking/countdown with exactly ${i.itemCount ?? 5} items, one scene per item, plus intro and outro` : "informative short video"}`,
    `Topic: ${i.topic}`,
    `Language for narration: ${i.language === "id" ? "Bahasa Indonesia" : i.language}`,
    `Target total duration: ${i.durationSec} seconds`,
    `Tone: ${i.tone}`,
  ];
  if (i.audience) lines.push(`Audience: ${i.audience}`);
  if (i.niche) lines.push(`Niche: ${i.niche}`);
  if (i.criteria) lines.push(`Ranking criteria: ${i.criteria}`);
  if (i.reference) lines.push(`Reference material provided by the user (only source of facts):\n"""${i.reference}"""`);
  return lines.join("\n");
}

export const relevanceSchema = z.object({ scores: z.array(z.number().min(0).max(1)) });

export function relevancePrompt(focus: string, texts: string[]): string {
  return [
    `Rate how relevant each transcript excerpt is to the focus "${focus}" and how self-contained it is as a standalone short clip.`,
    'Return JSON {"scores":[number 0..1 per excerpt, same order]}.',
    ...texts.map((t, i) => `#${i + 1}: ${t.slice(0, 1200)}`),
  ].join("\n");
}
