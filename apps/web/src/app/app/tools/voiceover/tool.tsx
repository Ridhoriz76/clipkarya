"use client";
import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { GeneratedLibrary } from "@/components/app/generated-library";
import { ToolJobs } from "@/components/app/tool-jobs";
import { VoicePicker, type VoiceChoice } from "@/components/app/voice-picker";
import { api } from "@/lib/client-api";
import { creditHint } from "@/lib/env";

export function VoiceoverTool() {
  const [voice, setVoice] = useState<VoiceChoice | null>(null);
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const submit = async () => {
    if (!voice) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/jobs", { method: "POST", json: { type: "voice", input: { text, voiceId: voice.id, provider: voice.provider, speed } } });
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
        <VoicePicker value={voice} onChange={setVoice} />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} className="min-h-36" placeholder="Tulis teks narasi…" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs"><span>Kecepatan</span><span className="text-muted-foreground">{speed.toFixed(2)}×</span></div>
            <Slider value={[speed]} min={0.7} max={1.3} step={0.05} onValueChange={([v]) => setSpeed(v!)} />
          </div>
          <span className="text-xs text-muted-foreground">{text.length}/5000{creditHint(Math.max(1, Math.ceil(text.length / 500)))}</span>
          <Button onClick={submit} disabled={busy || !voice || !text.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Mic />} Buat voiceover</Button>
        </div>
      </Card>
      <ToolJobs ids={ids} onSettled={() => setRk((k) => k + 1)} />
      <section>
        <h2 className="mb-3 font-semibold">Hasil voiceover</h2>
        <GeneratedLibrary source="tts" refreshKey={rk} />
      </section>
    </div>
  );
}
