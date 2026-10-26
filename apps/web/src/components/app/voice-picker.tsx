"use client";
import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";
import type { VoiceDTO } from "@/lib/types";

export type VoiceChoice = { id: string; provider: string; name: string; isDemo: boolean };

/** Voice selector populated from the configured providers' real voice catalogs. */
export function VoicePicker({ value, onChange }: { value: VoiceChoice | null; onChange: (v: VoiceChoice) => void }) {
  const [voices, setVoices] = useState<VoiceDTO[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    api<{ voices: VoiceDTO[]; errors: string[] }>("/api/voices")
      .then((r) => {
        setVoices(r.voices);
        setErrors(r.errors);
        if (!value && r.voices[0]) onChange({ id: r.voices[0].id, provider: r.voices[0].provider, name: r.voices[0].name, isDemo: r.voices[0].isDemo });
      })
      .catch(() => setVoices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (voices === null) return <p className="text-sm text-muted-foreground">Memuat suara…</p>;
  if (!voices.length) return <p className="text-sm text-muted-foreground">Belum ada penyedia suara terkonfigurasi (ELEVENLABS_API_KEY atau OPENAI_API_KEY).{errors[0] ? ` ${errors[0]}` : ""}</p>;
  const key = (v: { provider: string; id: string }) => `${v.provider}:${v.id}`;
  const current = value ? voices.find((v) => key(v) === key(value)) : undefined;
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value ? key(value) : undefined}
        onValueChange={(k) => {
          const v = voices.find((x) => key(x) === k)!;
          onChange({ id: v.id, provider: v.provider, name: v.name, isDemo: v.isDemo });
        }}
      >
        <SelectTrigger className="min-w-0"><SelectValue placeholder="Pilih suara" /></SelectTrigger>
        <SelectContent>
          {voices.map((v) => (
            <SelectItem key={key(v)} value={key(v)}>
              {v.name} · {v.provider}{[v.gender, v.accent, v.language].filter(Boolean).length ? ` · ${[v.gender, v.accent, v.language].filter(Boolean).join(", ")}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current?.previewUrl && (
        <Button type="button" variant="outline" size="icon" aria-label="Dengar contoh" onClick={() => void new Audio(current.previewUrl!).play()}>
          <Volume2 />
        </Button>
      )}
    </div>
  );
}
