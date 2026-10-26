"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import type { AssetDTO } from "@/lib/types";
import { formatDuration, formatRelative } from "@/lib/utils";

/** Grid of generated assets of one source type, with download and delete. */
export function GeneratedLibrary({ source, refreshKey }: { source: "tts" | "image_gen" | "video_gen"; refreshKey: number }) {
  const [assets, setAssets] = useState<AssetDTO[] | null>(null);
  const load = useCallback(() => api<{ assets: AssetDTO[] }>(`/api/assets?source=${source}&limit=60`).then((r) => setAssets(r.assets)), [source]);
  useEffect(() => {
    void load().catch(() => setAssets([]));
  }, [load, refreshKey]);
  const remove = async (id: string) => {
    try {
      await api(`/api/assets/${id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (!assets) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (!assets.length) return <p className="text-sm text-muted-foreground">Belum ada hasil.</p>;
  return (
    <div className={source === "tts" ? "space-y-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
      {assets.map((a) => (
        <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
          {source === "image_gen" && a.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.original_name ?? ""} className="aspect-square w-full object-cover" />
          )}
          {source === "video_gen" && a.url && <video src={a.url} controls playsInline className="aspect-video w-full bg-black" preload="metadata" />}
          <div className="flex items-center gap-2 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{a.original_name}</p>
              <p className="text-[11px] text-muted-foreground">{formatRelative(a.created_at)}{a.duration_sec ? ` · ${formatDuration(a.duration_sec)}` : ""}</p>
            </div>
            {a.is_demo && <Badge variant="demo">DEMO</Badge>}
            {source === "tts" && a.url && <audio src={a.url} controls className="h-8 w-48" preload="none" />}
            <Button size="icon-sm" variant="ghost" asChild><a href={`/api/assets/${a.id}/download`} aria-label="Unduh"><Download /></a></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => remove(a.id)} aria-label="Hapus"><Trash2 /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
