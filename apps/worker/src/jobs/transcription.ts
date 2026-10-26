import path from "node:path";
import { stat, readFile } from "node:fs/promises";
import { jobInputSchemas, UserFacingError, wordsToCues } from "@clipkarya/core";
import { getTranscriptionProvider } from "@clipkarya/core/providers";
import { getAsset } from "../assets";
import { extractSpeechAudio } from "../ffmpeg";
import { downloadObject, jobTmpDir } from "../storage";
import { db, must } from "../supabase";
import type { JobContext } from "../runner";
import type { AiJobRow } from "./types";

export async function transcriptionJob(ctx: JobContext<AiJobRow>) {
  const input = jobInputSchemas.transcription.parse(ctx.job.input);
  const provider = getTranscriptionProvider();
  const asset = await getAsset(input.assetId, ctx.job.user_id);
  if (asset.kind !== "video" && asset.kind !== "audio") throw new UserFacingError("Hanya video atau audio yang dapat ditranskripsi.");
  const dir = await jobTmpDir(ctx.job.id);
  const local = path.join(dir, `src${path.extname(asset.storage_path)}`);

  await ctx.progress(0.05, "download");
  await downloadObject(asset.storage_path, local);
  await ctx.ensureNotCanceled();

  await ctx.progress(0.2, "extract_audio");
  let audioPath = path.join(dir, "speech.mp3");
  await extractSpeechAudio(local, audioPath, 32);
  if ((await stat(audioPath)).size > provider.maxBytes) {
    audioPath = path.join(dir, "speech16.mp3");
    await extractSpeechAudio(local, audioPath, 16);
    if ((await stat(audioPath)).size > provider.maxBytes) {
      throw new UserFacingError("Audio terlalu panjang untuk penyedia transkripsi saat ini. Potong video menjadi bagian yang lebih pendek.", "too_long");
    }
  }
  await ctx.ensureNotCanceled();

  await ctx.progress(0.35, "transcribing");
  const { transcript, usage } = await provider.transcribe({
    audio: new Uint8Array(await readFile(audioPath)),
    filename: "speech.mp3",
    mimeType: "audio/mpeg",
    language: input.language,
    diarize: input.diarize,
    durationSec: asset.duration_sec ?? undefined,
  });
  await ctx.logUsage(usage, ctx.job.credits_cost, provider.isDemo);
  await ctx.progress(0.9, "saving");

  const row = must(
    await db()
      .from("transcripts")
      .insert({
        user_id: ctx.job.user_id,
        project_id: ctx.job.project_id,
        asset_id: asset.id,
        provider: provider.id,
        language: transcript.language,
        text: transcript.text,
        segments: transcript.segments,
        words: transcript.words,
        duration_sec: transcript.duration,
        is_demo: provider.isDemo,
      })
      .select("id")
      .single<{ id: string }>(),
    "insert transcript",
  );
  const cues = transcript.words.length
    ? wordsToCues(transcript.words, 6)
    : transcript.segments.map((s) => ({ start: s.start, end: s.end, text: s.text }));
  await db().from("subtitle_tracks").insert({
    user_id: ctx.job.user_id,
    project_id: ctx.job.project_id,
    transcript_id: row.id,
    language: transcript.language,
    label: provider.isDemo ? "Subtitle (DEMO)" : "Subtitle",
    cues,
  });
  return {
    output: { transcriptId: row.id, language: transcript.language, words: transcript.words.length, isDemo: provider.isDemo },
    patch: { provider: provider.id, is_demo: provider.isDemo },
  };
}
