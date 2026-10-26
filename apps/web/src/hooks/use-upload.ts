"use client";
import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/client-api";
import { STORAGE_BUCKET } from "@clipkarya/core";

export type UploadState = { name: string; progress: number; status: "uploading" | "processing" | "done" | "error"; error?: string; assetId?: string };

/**
 * Direct-to-storage upload: the server issues a signed upload URL after validating
 * type/size/plan limits, the browser uploads straight to Supabase Storage, then the
 * server confirms and queues FFprobe validation.
 */
export function useUpload() {
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const upload = useCallback(async (file: File, projectId?: string | null) => {
    const name = file.name;
    const update = (p: Partial<UploadState>) => setUploads((u) => u.map((x) => (x.name === name ? { ...x, ...p } : x)));
    setUploads((u) => [...u.filter((x) => x.name !== name), { name, progress: 0, status: "uploading" }]);
    try {
      const mime = file.type || guessMime(file.name);
      const init = await api<{ assetId: string; path: string; token: string; signedUrl: string }>("/api/uploads", {
        method: "POST",
        json: { filename: file.name, mimeType: mime, size: file.size, projectId: projectId ?? null },
      });
      update({ assetId: init.assetId, progress: 0.05 });
      await putWithProgress(init.signedUrl, file, mime, (f) => update({ progress: 0.05 + f * 0.9 }));
      update({ status: "processing", progress: 0.97 });
      const done = await api<{ assetId: string; jobId?: string }>(`/api/uploads/${init.assetId}/complete`, { method: "POST" });
      update({ status: "done", progress: 1 });
      return done;
    } catch (err) {
      update({ status: "error", error: (err as Error).message });
      throw err;
    }
  }, []);

  return { uploads, upload, clear: () => setUploads([]) };
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/x-m4a", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  return map[ext ?? ""] ?? "application/octet-stream";
}

/** XHR PUT to the signed URL so we can report upload progress (fetch has no upload progress). */
function putWithProgress(signedUrl: string, file: File, mime: string, onProgress: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (HTTP ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah."));
    xhr.send(file);
  });
}

// Kept for callers that prefer the SDK path (small files).
export async function uploadViaSdk(path: string, token: string, file: File) {
  const { error } = await createClient().storage.from(STORAGE_BUCKET).uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);
}
