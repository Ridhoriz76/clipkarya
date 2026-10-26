"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ASPECT_RATIO_LABELS, ASPECT_RATIOS } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { FREE_MODE } from "@/lib/env";

const MODE = { script: "script_to_video", story: "text_story", listicle: "listicle" } as const;
const TEMPLATE = { script: "educational", story: "storytelling", listicle: "top-five" } as const;

export function ScriptForm({ format, templateId, defaultAspectRatio, textAvailable }: { format: "script" | "story" | "listicle"; templateId?: string; defaultAspectRatio?: string; textAvailable: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ topic: "", audience: "", language: "id", durationSec: 45, tone: "santai dan informatif", niche: "", aspectRatio: defaultAspectRatio ?? "9:16", itemCount: 5, criteria: "", reference: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (generate: boolean) => {
    if (generate && f.topic.trim().length < 3) return toast.error("Isi topik terlebih dahulu.");
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        json: { title: f.topic.slice(0, 120) || "Naskah baru", mode: MODE[format], aspectRatio: f.aspectRatio, templateId: templateId ?? TEMPLATE[format] },
      });
      if (generate) {
        await api("/api/jobs", {
          method: "POST",
          json: {
            type: "script",
            projectId: id,
            input: {
              topic: f.topic,
              audience: f.audience || undefined,
              language: f.language,
              durationSec: f.durationSec,
              tone: f.tone,
              niche: f.niche || undefined,
              format,
              itemCount: format === "listicle" ? f.itemCount : undefined,
              criteria: format === "listicle" ? f.criteria || undefined : undefined,
              reference: f.reference || undefined,
            },
          },
        });
      }
      router.push(`/app/projects/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="topic">{format === "listicle" ? "Topik ranking" : format === "story" ? "Ide cerita" : "Topik atau prompt"}</Label>
        <Textarea id="topic" value={f.topic} onChange={(e) => set("topic", e.target.value)} maxLength={1000} placeholder={format === "listicle" ? "mis. 5 kebiasaan pagi yang meningkatkan fokus" : format === "story" ? "mis. seorang kurir menemukan surat misterius di paket terakhirnya" : "mis. cara mengatur gaji pertama"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target audiens"><Input value={f.audience} onChange={(e) => set("audience", e.target.value)} placeholder="mis. mahasiswa, pekerja muda" /></Field>
        <Field label="Niche"><Input value={f.niche} onChange={(e) => set("niche", e.target.value)} placeholder="mis. keuangan, kesehatan" /></Field>
        <Field label="Gaya & nada"><Input value={f.tone} onChange={(e) => set("tone", e.target.value)} /></Field>
        <Field label="Bahasa">
          <Select value={f.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="id">Bahasa Indonesia</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Durasi">
          <Select value={String(f.durationSec)} onValueChange={(v) => set("durationSec", Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[30, 45, 60, 90].map((d) => <SelectItem key={d} value={String(d)}>{d} detik</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Rasio">
          <Select value={f.aspectRatio} onValueChange={(v) => set("aspectRatio", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {format === "listicle" && (
          <>
            <Field label="Jumlah item">
              <Select value={String(f.itemCount)} onValueChange={(v) => set("itemCount", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[3, 5, 7, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} item</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Kriteria ranking"><Input value={f.criteria} onChange={(e) => set("criteria", e.target.value)} placeholder="mis. kemudahan dipraktikkan" /></Field>
          </>
        )}
      </div>
      <Field label={format === "listicle" ? "Materi sumber (disarankan)" : "Materi referensi (opsional)"}>
        <Textarea value={f.reference} onChange={(e) => set("reference", e.target.value)} maxLength={8000} className="min-h-24" placeholder="Tempel catatan, data, atau sumber. AI hanya memakai fakta dari sini; klaim lain ditandai perlu verifikasi." />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => submit(false)} disabled={busy}>Tulis manual</Button>
        <Button onClick={() => submit(true)} disabled={busy || !textAvailable}>
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Buat naskah{FREE_MODE ? "" : " (2 kredit)"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
