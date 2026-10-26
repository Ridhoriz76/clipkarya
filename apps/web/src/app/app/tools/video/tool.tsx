"use client";
import { useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ASPECT_RATIO_LABELS, ASPECT_RATIOS } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GeneratedLibrary } from "@/components/app/generated-library";
import { ToolJobs } from "@/components/app/tool-jobs";
import { api } from "@/lib/client-api";
import { creditHint } from "@/lib/env";

export function VideoTool({ disabled }: { disabled: boolean }) {
  const [f, setF] = useState({ prompt: "", negativePrompt: "", style: "sinematik", aspectRatio: "9:16", durationSec: 5, resolution: "720p" });
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const submit = async () => {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/jobs", { method: "POST", json: { type: "video", input: { ...f, negativePrompt: f.negativePrompt || undefined } } });
      setIds((x) => [id, ...x]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <Textarea value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} maxLength={2000} placeholder="Deskripsikan adegan, gerakan kamera, dan suasana…" className="min-h-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5"><Label>Gaya visual</Label><Input value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Rasio</Label>
            <Select value={f.aspectRatio} onValueChange={(v) => setF({ ...f, aspectRatio: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Durasi</Label>
            <Select value={String(f.durationSec)} onValueChange={(v) => setF({ ...f, durationSec: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 detik{creditHint(20)}</SelectItem>
                <SelectItem value="10">10 detik{creditHint(40)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Resolusi</Label>
            <Select value={f.resolution} onValueChange={(v) => setF({ ...f, resolution: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="720p">720p</SelectItem><SelectItem value="1080p">1080p (jika didukung model)</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Prompt negatif (opsional)</Label><Input value={f.negativePrompt} onChange={(e) => setF({ ...f, negativePrompt: e.target.value })} placeholder="mis. blur, teks, watermark" /></div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={disabled || busy || f.prompt.trim().length < 3}>{busy ? <Loader2 className="animate-spin" /> : <Clapperboard />} Hasilkan video</Button>
        </div>
      </Card>
      <ToolJobs ids={ids} onSettled={() => setRk((k) => k + 1)} />
      <section>
        <h2 className="mb-3 font-semibold">Hasil</h2>
        <GeneratedLibrary source="video_gen" refreshKey={rk} />
      </section>
    </div>
  );
}
