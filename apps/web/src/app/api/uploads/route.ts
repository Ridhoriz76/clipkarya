import { randomUUID } from "node:crypto";
import { extFromMime, isFreeMode, mediaKindFromMime, STORAGE_BUCKET, storagePath, UPLOAD_LIMITS } from "@clipkarya/core";
import { z } from "zod";
import { ApiError, json, parseBody, withAuth } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const body = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  projectId: z.uuid().nullable().optional(),
});

/**
 * Step 1 of the upload flow: validate type/size against plan limits, create a
 * pending media_assets row and return a signed upload URL for direct-to-storage upload.
 */
export const POST = withAuth(async ({ req, userId, supabase }) => {
  await rateLimit(userId, "upload", 30, 60);
  const b = await parseBody(req, body);
  const kind = mediaKindFromMime(b.mimeType);
  if (!kind) throw new ApiError(415, "Format file tidak didukung. Gunakan MP4, MOV, WEBM, MP3, WAV, M4A, PNG, JPG, atau WEBP.", "unsupported_type");

  const { data: sub } = isFreeMode()
    ? { data: null }
    : await supabase
    .from("user_subscriptions")
    .select("plan:subscription_plans(max_upload_mb)")
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle<{ plan: { max_upload_mb: number } | null }>();
  const maxBytes = sub ? Math.min(UPLOAD_LIMITS.maxBytes, (sub.plan?.max_upload_mb ?? 500) * 1024 * 1024) : UPLOAD_LIMITS.maxBytes;
  if (b.size > maxBytes) throw new ApiError(413, `Ukuran file melebihi batas (${Math.round(maxBytes / 1024 / 1024)} MB).`, "too_large");

  if (b.projectId) {
    const { data } = await supabase.from("projects").select("id").eq("id", b.projectId).maybeSingle();
    if (!data) throw new ApiError(404, "Proyek tidak ditemukan.", "not_found");
  }

  const id = randomUUID();
  const path = storagePath(userId, id, extFromMime(b.mimeType), b.projectId);
  const admin = createAdminClient();
  const { error } = await admin.from("media_assets").insert({
    id,
    user_id: userId,
    project_id: b.projectId ?? null,
    kind,
    source: "upload",
    status: "pending_upload",
    storage_path: path,
    original_name: b.filename.slice(0, 255),
    mime_type: b.mimeType,
    size_bytes: b.size,
  });
  if (error) throw new Error(error.message);
  const { data: signed, error: sErr } = await admin.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (sErr || !signed) throw new Error(sErr?.message ?? "signed upload failed");
  return json({ assetId: id, path, token: signed.token, signedUrl: signed.signedUrl, kind });
});
