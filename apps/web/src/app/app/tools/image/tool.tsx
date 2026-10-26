"use client";
import { useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ASPECT_RATIO_LABELS, ASPECT_RATIOS } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GeneratedLibrary } from "@/components/app/generated-library";
import { ToolJobs } from "@/components/app/tool-jobs";
import { api } from "@/lib/client-api";
import { creditHint } from "@/lib/env";

export function ImageTool({ disabled }: { disabled: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAr] = useState("9:16");
  const [count, setCount] = useState(1);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const submit = async () => {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/jobs", { method: "POST", json: { type: "image", input: { prompt, aspectRatio, count } } });
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
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} placeholder="Deskripsikan gambar, mis. 'secangkir kopi di meja kayu, cahaya pagi, gaya foto produk'" className="min-h-24" />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Rasio</Label>
            <Select value={aspectRatio} onValueChange={setAr}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jumlah</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} gambar{creditHint(n * 3)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={submit} disabled={disabled || busy || prompt.trim().length < 3}>{busy ? <Loader2 className="animate-spin" /> : <ImageIcon />} Hasilkan</Button>
        </div>
      </Card>
      <ToolJobs ids={ids} onSettled={() => setRk((k) => k + 1)} />
      <section>
        <h2 className="mb-3 font-semibold">Galeri</h2>
        <GeneratedLibrary source="image_gen" refreshKey={rk} />
      </section>
    </div>
  );
}
