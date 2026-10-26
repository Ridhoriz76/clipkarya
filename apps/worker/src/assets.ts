import { randomUUID } from "node:crypto";
import { storagePath, type MediaKind } from "@clipkarya/core";
import { db, must } from "./supabase";
import { uploadBytes, uploadFile } from "./storage";
import { probe } from "./ffmpeg";

export type AssetRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: MediaKind;
  status: string;
  storage_path: string;
  mime_type: string;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  has_audio: boolean | null;
  thumbnail_path: string | null;
  is_demo: boolean;
  original_name: string | null;
  size_bytes: number | null;
};

export async function getAsset(id: string, userId: string): Promise<AssetRow> {
  return must(await db().from("media_assets").select("*").eq("id", id).eq("user_id", userId).single<AssetRow>(), `asset ${id}`);
}

/** Register a worker-produced file as a ready media asset owned by the job's user. */
export async function createAssetFromFile(opts: {
  userId: string;
  projectId: string | null;
  kind: MediaKind;
  source: "tts" | "image_gen" | "video_gen" | "render" | "derived";
  file?: string;
  bytes?: Uint8Array;
  mime: string;
  ext: string;
  name: string;
  isDemo?: boolean;
  metadata?: Record<string, unknown>;
  withProbe?: boolean;
}): Promise<AssetRow> {
  const id = randomUUID();
  const key = storagePath(opts.userId, id, opts.ext, opts.projectId);
  let size: number;
  if (opts.file) size = await uploadFile(key, opts.file, opts.mime);
  else if (opts.bytes) {
    await uploadBytes(key, opts.bytes, opts.mime);
    size = opts.bytes.byteLength;
  } else throw new Error("createAssetFromFile needs file or bytes");
  const meta = opts.withProbe && opts.file ? await probe(opts.file) : null;
  return must(
    await db()
      .from("media_assets")
      .insert({
        id,
        user_id: opts.userId,
        project_id: opts.projectId,
        kind: opts.kind,
        source: opts.source,
        status: "ready",
        storage_path: key,
        original_name: opts.name,
        mime_type: opts.mime,
        size_bytes: size,
        duration_sec: meta?.durationSec ?? null,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        has_audio: meta?.hasAudio ?? null,
        is_demo: opts.isDemo ?? false,
        metadata: opts.metadata ?? {},
      })
      .select("*")
      .single<AssetRow>(),
    "insert asset",
  );
}
