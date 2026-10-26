"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CAPTION_FONTS, CAPTION_POSITIONS, type CaptionStyle } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { VoicePicker, type VoiceChoice } from "@/components/app/voice-picker";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/lib/client-api";

type Font = (typeof CAPTION_FONTS)[number];
export type BrandKitValue = {
  name: string;
  colors: string[];
  fonts: { heading: Font; body: Font };
  caption_preset: Partial<CaptionStyle>;
  default_voice: { provider: string; voiceId: string; name: string } | null;
  logo_asset_id: string | null;
  intro_asset_id: string | null;
  outro_asset_id: string | null;
};
export type LibraryAsset = { id: string; kind: "image" | "video"; name: string; previewUrl: string | null };

const NONE = "none";

export function BrandKitForm({ initial, library }: { initial: BrandKitValue & { caption_preset: CaptionStyle }; library: LibraryAsset[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { upload, uploads } = useUpload();
  const cap = v.caption_preset;
  const setCap = (p: Partial<CaptionStyle>) => setV((x) => ({ ...x, caption_preset: { ...x.caption_preset, ...p } }));

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/brand-kit", { method: "PUT", json: v });
      toast.success("Brand kit disimpan.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const uploadInto = async (field: "logo_asset_id" | "intro_asset_id" | "outro_asset_id", accept: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const res = await upload(f, null);
        setV((x) => ({ ...x, [field]: res.assetId }));
        toast.success("Diunggah. Media sedang divalidasi; simpan brand kit untuk memakainya.");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    input.click();
  };

  const assetSelect = (field: "logo_asset_id" | "intro_asset_id" | "outro_asset_id", label: string, kind: "image" | "video") => {
    const options = library.filter((a) => a.kind === kind);
    const current = library.find((a) => a.id === v[field]);
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {current?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.previewUrl} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">–</span>
            )}
          </div>
          <Select value={v[field] ?? NONE} onValueChange={(id) => setV((x) => ({ ...x, [field]: id === NONE ? null : id }))}>
            <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Tidak ada</SelectItem>
              {v[field] && !current && <SelectItem value={v[field]!}>Media sedang diproses…</SelectItem>}
              {options.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" aria-label={`Unggah ${label}`} onClick={() => uploadInto(field, kind === "image" ? "image/png,image/jpeg,image/webp" : "video/*")}>
            <Upload />
          </Button>
        </div>
      </div>
    );
  };

  const busyUpload = uploads.some((u) => u.status === "uploading");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identitas</CardTitle>
          <CardDescription>Nama, warna, dan font brand Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="kit-name">Nama brand</Label>
            <Input id="kit-name" value={v.name} maxLength={100} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Palet warna</Label>
            <div className="flex flex-wrap items-center gap-2">
              {v.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-1 rounded-lg border border-border p-1 pr-2">
                  <input
                    type="color"
                    value={c}
                    aria-label={`Warna ${i + 1}`}
                    onChange={(e) => setV({ ...v, colors: v.colors.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)) })}
                    className="size-8 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs">{c}</span>
                  {v.colors.length > 1 && (
                    <button type="button" aria-label="Hapus warna" className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => setV({ ...v, colors: v.colors.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {v.colors.length < 8 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, colors: [...v.colors, "#FFFFFF"] })}>
                  <Plus /> Warna
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["heading", "body"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label>{k === "heading" ? "Font judul" : "Font isi"}</Label>
                <Select value={v.fonts[k]} onValueChange={(f) => setV({ ...v, fonts: { ...v.fonts, [k]: f as Font } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CAPTION_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Hanya font yang terpasang di server render yang ditawarkan, agar hasil ekspor sama dengan pratinjau.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo, intro & outro</CardTitle>
          <CardDescription>Pilih dari pustaka media atau unggah file baru.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          {assetSelect("logo_asset_id", "Logo", "image")}
          {assetSelect("intro_asset_id", "Intro", "video")}
          {assetSelect("outro_asset_id", "Outro", "video")}
          {busyUpload && <p className="text-xs text-muted-foreground md:col-span-3">Mengunggah… {Math.round((uploads.find((u) => u.status === "uploading")?.progress ?? 0) * 100)}%</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preset subtitle</CardTitle>
          <CardDescription>Gaya default untuk subtitle di proyek baru.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Font</Label>
              <Select value={cap.font} onValueChange={(f) => setCap({ font: f as Font })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CAPTION_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posisi</Label>
              <Select value={cap.position} onValueChange={(p) => setCap({ position: p as CaptionStyle["position"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CAPTION_POSITIONS.map((p) => <SelectItem key={p} value={p}>{{ top: "Atas", middle: "Tengah", bottom: "Bawah" }[p] ?? p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ukuran: {cap.size}px</Label>
              <Slider min={16} max={160} step={2} value={[cap.size]} onValueChange={([n]) => setCap({ size: n })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Kata per subtitle: {cap.maxWordsPerCaption}</Label>
              <Slider min={1} max={12} step={1} value={[cap.maxWordsPerCaption]} onValueChange={([n]) => setCap({ maxWordsPerCaption: n })} />
            </div>
            {([
              ["color", "Teks"],
              ["highlightColor", "Sorotan kata"],
              ["outlineColor", "Garis tepi"],
              ["backgroundColor", "Latar"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                {label}
                <input type="color" value={cap[k]} onChange={(e) => setCap({ [k]: e.target.value.toUpperCase() })} className="size-7 cursor-pointer rounded border-0 bg-transparent" />
              </label>
            ))}
            {([
              ["bold", "Tebal"],
              ["uppercase", "Huruf kapital"],
              ["karaoke", "Sorot kata yang diucapkan"],
              ["background", "Kotak latar"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                {label}
                <Switch checked={cap[k]} onCheckedChange={(c) => setCap({ [k]: c })} />
              </label>
            ))}
          </div>
          <CaptionPreview style={cap} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suara default</CardTitle>
          <CardDescription>Dipakai sebagai pilihan awal untuk voiceover.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoicePicker
            value={v.default_voice ? { id: v.default_voice.voiceId, provider: v.default_voice.provider, name: v.default_voice.name, isDemo: false } : null}
            onChange={(c: VoiceChoice) => setV((x) => ({ ...x, default_voice: { provider: c.provider, voiceId: c.id, name: c.name } }))}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={saving || busyUpload}>
          {saving && <Loader2 className="animate-spin" />} Simpan brand kit
        </Button>
      </div>
    </div>
  );
}

function CaptionPreview({ style }: { style: CaptionStyle }) {
  const words = ["Ide", "jadi", "video", "pendek"].slice(0, Math.max(1, style.maxWordsPerCaption));
  const pos = { top: "items-start pt-10", middle: "items-center", bottom: "items-end pb-14" }[style.position] ?? "items-end pb-14";
  return (
    <div className={`relative flex aspect-[9/16] w-full max-w-[260px] justify-center overflow-hidden rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 ${pos}`}>
      <span
        className="px-2 py-1 text-center leading-tight"
        style={{
          fontFamily: style.font,
          fontSize: style.size * (260 / 1080),
          fontWeight: style.bold ? 800 : 500,
          textTransform: style.uppercase ? "uppercase" : "none",
          color: style.color,
          WebkitTextStroke: style.outlineWidth ? `${style.outlineWidth * (260 / 1080)}px ${style.outlineColor}` : undefined,
          paintOrder: "stroke fill",
          background: style.background ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, "0")}` : undefined,
          borderRadius: 4,
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{ color: style.karaoke && i === 1 ? style.highlightColor : undefined }}>
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </div>
  );
}
