import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { STORAGE_BUCKET } from "@clipkarya/core";
import { db } from "./supabase";
import { env } from "./env";

export async function jobTmpDir(jobId: string): Promise<string> {
  const dir = path.join(env().WORKER_TMP_DIR, jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupTmp(jobId: string): Promise<void> {
  await rm(path.join(env().WORKER_TMP_DIR, jobId), { recursive: true, force: true });
}

/** Stream an object from storage to disk via a short-lived signed URL (handles multi-GB files). */
export async function downloadObject(storagePath: string, dest: string): Promise<string> {
  const { data, error } = await db().storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data) throw new Error(`signed url: ${error?.message}`);
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) throw new Error(`download ${storagePath}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(dest));
  return dest;
}

export async function uploadFile(storagePath: string, filePath: string, contentType: string): Promise<number> {
  const size = (await stat(filePath)).size;
  // supabase-js uploads buffers; outputs are bounded (renders/derived media), so reading into memory is acceptable.
  const body = await readFile(filePath);
  const { error } = await db().storage.from(STORAGE_BUCKET).upload(storagePath, body, { contentType, upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return size;
}

export async function uploadBytes(storagePath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await db().storage.from(STORAGE_BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
}
