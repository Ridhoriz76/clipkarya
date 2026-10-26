"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dropzone } from "@/components/upload/dropzone";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/lib/client-api";
import { FREE_MODE } from "@/lib/env";

export function AutoClipForm() {
  const router = useRouter();
  const { uploads, upload } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("id");
  const [range, setRange] = useState("15-60");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const state = uploads[0];

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const [minDuration, maxDuration] = range.split("-").map(Number);
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        json: {
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
          mode: "auto_clip",
          aspectRatio: "9:16",
          autoClip: { language: language === "auto" ? undefined : language, focus: focus || undefined, minDuration, maxDuration, maxCandidates: 8 },
        },
      });
      await upload(file, id);
      router.push(`/app/projects/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-5 p-5">
      <Dropzone accept="video/mp4,video/quicktime,video/webm,video/x-matroska" file={file} onFile={setFile} hint="MP4, MOV, WEBM, MKV · hingga 2 GB · maks. 3 jam" disabled={busy} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Bahasa ucapan</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="id">Bahasa Indonesia</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="auto">Deteksi otomatis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Durasi klip</Label>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10-30">10–30 detik</SelectItem>
              <SelectItem value="15-60">15–60 detik</SelectItem>
              <SelectItem value="30-90">30–90 detik</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="focus">Fokus topik (opsional)</Label>
        <Input id="focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="mis. tips keuangan untuk pemula" maxLength={300} />
        <p className="text-xs text-muted-foreground">Jika penyedia teks terkonfigurasi, relevansi terhadap fokus ikut dinilai.</p>
      </div>
      {state && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{state.status === "uploading" ? "Mengunggah…" : state.status === "processing" ? "Memverifikasi…" : state.status === "error" ? state.error : "Selesai"}</span>
            <span>{Math.round(state.progress * 100)}%</span>
          </div>
          <Progress value={state.progress * 100} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        {!FREE_MODE && <p className="text-xs text-muted-foreground">Biaya: 1 kredit/menit transkripsi + 2 kredit analisis klip.</p>}
        <Button onClick={submit} disabled={!file || busy}>{busy && <Loader2 className="animate-spin" />} Unggah & analisis</Button>
      </div>
    </Card>
  );
}
