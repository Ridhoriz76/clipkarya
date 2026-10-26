"use client";
import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { estimateRenderCredits, timelineDuration, type Timeline } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { JobStatusBadge } from "@/components/app/job-status";
import { useJobs } from "@/hooks/use-jobs";
import { api, ClientApiError } from "@/lib/client-api";
import { formatRelative } from "@/lib/utils";
import { FREE_MODE } from "@/lib/env";

export function ExportDialog({ projectId, doc, flush }: { projectId: string; doc: Timeline; flush: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<"720p" | "1080p">(doc.resolution);
  const [burnCaptions, setBurn] = useState(true);
  const [exportSrt, setSrt] = useState(true);
  const [busy, setBusy] = useState(false);
  const { jobs, refresh } = useJobs({ projectId });
  const renders = jobs.filter((j) => j.kind === "render");
  const duration = timelineDuration(doc);
  const hasCaptions = doc.items.some((i) => i.type === "caption");
  const cost = estimateRenderCredits(duration, resolution);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const start = async () => {
    setBusy(true);
    try {
      await flush(); // the export renders the saved state, so save first
      await api(`/api/projects/${projectId}/render`, { method: "POST", json: { resolution, burnCaptions, exportSrt, normalizeAudio: true } });
      toast.success("Render dimulai.");
      await refresh();
    } catch (e) {
      const err = e as ClientApiError;
      toast.error(err.code === "plan_limit" ? "Ekspor 1080p tersedia di paket berbayar." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload /> Ekspor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ekspor video</DialogTitle>
          <DialogDescription>MP4 (H.264 + AAC) · {doc.aspectRatio} · {duration.toFixed(1)} detik</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Resolusi</Label>
            <Select value={resolution} onValueChange={(v) => setResolution(v as "720p" | "1080p")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between text-sm">
            Tanamkan subtitle ke video
            <Switch checked={burnCaptions} onCheckedChange={setBurn} disabled={!hasCaptions} />
          </label>
          <label className="flex items-center justify-between text-sm">
            Sertakan file SRT terpisah
            <Switch checked={exportSrt} onCheckedChange={setSrt} disabled={!hasCaptions} />
          </label>
          <Button className="w-full" onClick={start} disabled={busy || duration <= 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Render{FREE_MODE ? "" : ` (${cost} kredit)`}
          </Button>
          {duration <= 0 && <p className="text-xs text-muted-foreground">Timeline kosong.</p>}
        </div>
        {renders.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium">Riwayat ekspor</p>
            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {renders.map((r) => (
                <div key={r.id} className="space-y-2 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{String((r.settings as { resolution?: string } | null)?.resolution ?? "")}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(r.created_at)}</span>
                    <span className="ml-auto"><JobStatusBadge status={r.status} /></span>
                  </div>
                  {(r.status === "processing" || r.status === "queued") && <Progress value={r.progress * 100} />}
                  {r.status === "failed" && <p className="text-xs text-destructive">{r.error_message}</p>}
                  {r.status === "completed" && r.output_asset_id && (
                    <div className="flex gap-2">
                      <Button size="sm" asChild><a href={`/api/assets/${r.output_asset_id}/download`}><Download /> MP4</a></Button>
                      {r.srt_asset_id && <Button size="sm" variant="outline" asChild><a href={`/api/assets/${r.srt_asset_id}/download`}><FileText /> SRT</a></Button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
