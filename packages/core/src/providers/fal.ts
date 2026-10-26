import { providerFetch, ProviderError } from "./http";
import type { ImageProvider, VideoJobState, VideoProvider } from "./types";

export type FalConfig = { apiKey: string; videoModel: string; imageModel: string };

const QUEUE = "https://queue.fal.run";

type QueueSubmit = { request_id: string; status_url?: string; response_url?: string };

/**
 * fal.ai queue API. We persist the status/response URLs returned at submission
 * (encoded in requestId) because model ids with sub-paths resolve their request
 * URLs against the app root.
 */
export function falVideo(cfg: FalConfig): VideoProvider {
  const auth = { Authorization: `Key ${cfg.apiKey}` };
  return {
    id: "fal",
    isDemo: false,
    async submit({ prompt, negativePrompt, aspectRatio, durationSec }) {
      // Kling-style inputs: duration is a string ("5" | "10"); other models ignore unknown fields.
      const duration = durationSec > 7 ? "10" : "5";
      const res = await providerFetch(
        `${QUEUE}/${cfg.videoModel}`,
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, negative_prompt: negativePrompt, aspect_ratio: aspectRatio, duration }),
        },
        { provider: "fal", timeoutMs: 30_000 },
      );
      const body = (await res.json()) as QueueSubmit;
      const requestId = JSON.stringify({
        id: body.request_id,
        status: body.status_url ?? `${QUEUE}/${cfg.videoModel}/requests/${body.request_id}/status`,
        response: body.response_url ?? `${QUEUE}/${cfg.videoModel}/requests/${body.request_id}`,
      });
      return {
        requestId,
        usage: { provider: "fal", operation: "video", units: Number(duration), unitType: "seconds", estimatedCostUsd: null, model: cfg.videoModel },
      };
    },
    async poll(requestId): Promise<VideoJobState> {
      const ref = JSON.parse(requestId) as { id: string; status: string; response: string };
      const st = await providerFetch(ref.status, { headers: auth }, { provider: "fal", timeoutMs: 20_000 });
      const status = (await st.json()) as { status: string; queue_position?: number };
      if (status.status === "IN_QUEUE") return { state: "queued", queuePosition: status.queue_position ?? null };
      if (status.status === "IN_PROGRESS") return { state: "processing" };
      if (status.status !== "COMPLETED") return { state: "failed", error: `Unexpected status ${status.status}` };
      const rr = await fetch(ref.response, { headers: auth });
      if (!rr.ok) return { state: "failed", error: `Result HTTP ${rr.status}` };
      const result = (await rr.json()) as { video?: { url?: string } };
      if (!result.video?.url) return { state: "failed", error: "Provider returned no video" };
      return { state: "completed", videoUrl: result.video.url };
    },
  };
}

const FAL_IMAGE_SIZES = { "9:16": "portrait_16_9", "16:9": "landscape_16_9", "1:1": "square_hd" } as const;

export function falImage(cfg: FalConfig): ImageProvider {
  return {
    id: "fal",
    isDemo: false,
    async generate({ prompt, aspectRatio, count }) {
      const res = await providerFetch(
        `https://fal.run/${cfg.imageModel}`,
        {
          method: "POST",
          headers: { Authorization: `Key ${cfg.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, image_size: FAL_IMAGE_SIZES[aspectRatio], num_images: count }),
        },
        { provider: "fal", timeoutMs: 180_000, retries: 1 },
      );
      const body = (await res.json()) as { images?: { url: string; content_type?: string }[] };
      if (!body.images?.length) throw new ProviderError("fal", "No images returned");
      const images = await Promise.all(
        body.images.map(async (img) => {
          const r = await providerFetch(img.url, {}, { provider: "fal" });
          const mime = img.content_type ?? r.headers.get("content-type") ?? "image/jpeg";
          return { data: new Uint8Array(await r.arrayBuffer()), mimeType: mime, ext: mime.includes("png") ? "png" : "jpg" };
        }),
      );
      return { images, usage: { provider: "fal", operation: "image", units: images.length, unitType: "images", estimatedCostUsd: null, model: cfg.imageModel } };
    },
  };
}
