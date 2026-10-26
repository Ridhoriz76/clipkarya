"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Clapperboard, Image as ImageIcon, Loader2, Mic, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Notice, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { VoicePicker, type VoiceChoice } from "@/components/app/voice-picker";
import { useJobs } from "@/hooks/use-jobs";
import { api } from "@/lib/client-api";
import type { SceneDTO } from "@/lib/types";

type Caps = Record<"text" | "transcription" | "speech" | "image" | "video", { available: boolean; demoOnly: boolean }>;

export function ScriptWorkspace({ project, scenes: initial, caps }: { project: { id: string; title: string; mode: string; settings: Record<string, unknown> }; scenes: SceneDTO[]; caps: Caps }) {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneDTO[]>(initial);
  const [voice, setVoice] = useState<VoiceChoice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { jobs } = useJobs({ projectId: project.id, onSettled: () => router.refresh() });
  // Reset local edits when the server sends fresh scenes (after router.refresh()).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setScenes(initial);
  }
  const scriptJob = jobs.find((j) => j.type === "script");
  const active = jobs.filter((j) => ["queued", "processing"].includes(j.status));
  const dirty = JSON.stringify(scenes.map(strip)) !== JSON.stringify(initial.map(strip));
  const meta = project.settings.script as { hook?: string; ending?: string; hashtags?: string[] } | undefined;

  const update = (i: number, patch: Partial<SceneDTO>) => setScenes((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setScenes((s) => {
      const n = [...s];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x!);
      return n;
    });

  const save = async () => {
    await api(`/api/projects/${project.id}/scenes`, {
      method: "PUT",
      json: {
        scenes: scenes.map((s) => ({
          id: s.id.startsWith("new-") ? undefined : s.id,
          title: s.title,
          narration: s.narration,
          visual_description: s.visual_description,
          on_screen_text: s.on_screen_text,
          duration_sec: s.duration_sec,
          needs_verification: s.needs_verification,
          image_asset_id: s.image_asset_id,
          voice_asset_id: s.voice_asset_id,
        })),
      },
    });
  };

  const withBusy = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const genVoices = withBusy("voice", async () => {
    if (!voice) throw new Error("Pilih suara terlebih dahulu.");
    if (dirty) await save();
    router.refresh();
    let n = 0;
    for (const s of scenes) {
      if (!s.narration.trim() || s.id.startsWith("new-")) continue;
      await api("/api/jobs", { method: "POST", json: { type: "voice", projectId: project.id, input: { text: s.narration, voiceId: voice.id, provider: voice.provider, sceneId: s.id } } });
      n++;
    }
    toast.success(`${n} voiceover sedang dibuat.`);
  });

  const genImages = withBusy("image", async () => {
    if (dirty) await save();
    let n = 0;
    for (const s of scenes) {
      if (s.image_asset_id || !s.visual_description.trim() || s.id.startsWith("new-")) continue;
      await api("/api/jobs", { method: "POST", json: { type: "image", projectId: project.id, input: { prompt: s.visual_description, aspectRatio: "9:16", count: 1, sceneId: s.id } } });
      n++;
    }
    toast.success(n ? `${n} gambar sedang dibuat.` : "Semua scene sudah punya gambar.");
  });

  const assemble = withBusy("assemble", async () => {
    if (dirty) await save();
    await api(`/api/projects/${project.id}/assemble`, { method: "POST" });
    router.push(`/app/projects/${project.id}/edit`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description="Tinjau dan edit naskah per scene sebelum membuat voiceover, visual, dan video."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={withBusy("save", async () => { await save(); toast.success("Naskah disimpan."); router.refresh(); })} disabled={!dirty || !!busy}>
              <Save /> Simpan
            </Button>
            <Button size="sm" onClick={assemble} disabled={!scenes.length || !!busy}>
              {busy === "assemble" ? <Loader2 className="animate-spin" /> : <Clapperboard />} Susun ke editor
            </Button>
          </>
        }
      />
      {scriptJob && ["queued", "processing"].includes(scriptJob.status) && (
        <Card className="space-y-2 p-4"><p className="text-sm">AI sedang menulis naskah…</p><Progress value={scriptJob.progress * 100} /></Card>
      )}
      {scriptJob?.status === "failed" && <Notice variant="error" title="Gagal membuat naskah">{scriptJob.error_message}</Notice>}
      {meta?.hook && (
        <Card className="p-4 text-sm">
          <p><span className="text-muted-foreground">Hook:</span> {meta.hook}</p>
          {meta.ending && <p className="mt-1"><span className="text-muted-foreground">Penutup:</span> {meta.ending}</p>}
          {meta.hashtags?.length ? <p className="mt-2 text-xs text-muted-foreground">{meta.hashtags.join(" ")}</p> : null}
        </Card>
      )}
      {scenes.some((s) => s.needs_verification) && (
        <Notice variant="warning" title="Ada klaim yang perlu diverifikasi">Scene bertanda ⚠ berisi klaim yang tidak didukung materi sumber. Edit atau hapus sebelum dipublikasikan.</Notice>
      )}

      <Card className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Suara narasi</p>
          {caps.speech.available ? <VoicePicker value={voice} onChange={setVoice} /> : <p className="text-sm text-muted-foreground">Penyedia suara belum dikonfigurasi.</p>}
        </div>
        <Button variant="outline" onClick={genVoices} disabled={!caps.speech.available || !scenes.length || !!busy}>
          {busy === "voice" ? <Loader2 className="animate-spin" /> : <Mic />} Voiceover semua scene
        </Button>
        <Button variant="outline" onClick={genImages} disabled={!caps.image.available || !scenes.length || !!busy} title={caps.image.available ? undefined : "Perlu OPENAI_API_KEY atau FAL_KEY"}>
          {busy === "image" ? <Loader2 className="animate-spin" /> : <ImageIcon />} Gambar AI untuk scene
        </Button>
        {active.length > 0 && <p className="text-xs text-muted-foreground md:col-span-3">{active.length} job berjalan…</p>}
      </Card>

      <div className="space-y-3">
        {scenes.map((s, i) => (
          <Card key={s.id} className="p-4">
            <div className="flex gap-4">
              <div className="w-24 shrink-0 space-y-2">
                <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.imageUrl ? <img src={s.imageUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-5 text-muted-foreground/60" />}
                </div>
                {s.voiceUrl && <audio src={s.voiceUrl} controls className="h-8 w-24" />}
                {s.voiceIsDemo && <Badge variant="demo">DEMO</Badge>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">#{i + 1}</span>
                  <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} className="h-8" />
                  {s.needs_verification && (
                    <button onClick={() => update(i, { needs_verification: false })} title="Tandai sudah diverifikasi">
                      <AlertTriangle className="size-4 text-amber-500" />
                    </button>
                  )}
                  <Input type="number" min={1} max={60} value={s.duration_sec} onChange={(e) => update(i, { duration_sec: Math.max(1, Number(e.target.value)) })} className="h-8 w-20" aria-label="Durasi (detik)" />
                </div>
                <Textarea value={s.narration} onChange={(e) => update(i, { narration: e.target.value, voice_asset_id: e.target.value === initial[i]?.narration ? s.voice_asset_id : null })} placeholder="Narasi" className="min-h-16" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={s.visual_description} onChange={(e) => update(i, { visual_description: e.target.value })} placeholder="Deskripsi visual" />
                  <Input value={s.on_screen_text} onChange={(e) => update(i, { on_screen_text: e.target.value })} placeholder="Teks di layar" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naik"><ArrowUp /></Button>
                <Button size="icon-sm" variant="ghost" disabled={i === scenes.length - 1} onClick={() => move(i, 1)} aria-label="Turun"><ArrowDown /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => setScenes((x) => x.filter((_, j) => j !== i))} aria-label="Hapus scene"><Trash2 /></Button>
              </div>
            </div>
          </Card>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            setScenes((x) => [
              ...x,
              { id: `new-${Date.now()}`, position: x.length, title: `Scene ${x.length + 1}`, narration: "", visual_description: "", on_screen_text: "", duration_sec: 5, needs_verification: false, image_asset_id: null, voice_asset_id: null },
            ])
          }
        >
          <Plus /> Tambah scene
        </Button>
      </div>
    </div>
  );
}

function strip(s: SceneDTO) {
  return [s.id, s.title, s.narration, s.visual_description, s.on_screen_text, s.duration_sec, s.needs_verification];
}
