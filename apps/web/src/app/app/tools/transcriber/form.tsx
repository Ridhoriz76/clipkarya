"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dropzone } from "@/components/upload/dropzone";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/lib/client-api";
import { FREE_MODE } from "@/lib/env";

export function TranscriberForm() {
  const router = useRouter();
  const { upload, uploads } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("id");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        json: { title: file.name.replace(/\.[^.]+$/, "").slice(0, 120), mode: "transcriber", autoClip: { language: language === "auto" ? undefined : language } },
      });
      await upload(file, id);
      router.push(`/app/projects/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-4 p-5">
      <Dropzone accept="video/*,audio/*" file={file} onFile={setFile} hint="Video atau audio · maks. 3 jam" disabled={busy} />
      <div className="space-y-1.5">
        <Label>Bahasa</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="id">Bahasa Indonesia</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="auto">Deteksi otomatis</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {uploads[0] && <Progress value={uploads[0].progress * 100} />}
      <div className="flex justify-between gap-3">
        {!FREE_MODE && <p className="text-xs text-muted-foreground">1 kredit per menit audio.</p>}
        <Button onClick={submit} disabled={!file || busy}>{busy && <Loader2 className="animate-spin" />} Unggah & transkripsi</Button>
      </div>
    </Card>
  );
}
