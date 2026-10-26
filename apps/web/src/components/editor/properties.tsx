"use client";
import {
  ASPECT_RATIO_LABELS,
  ASPECT_RATIOS,
  CAPTION_FONTS,
  CAPTION_POSITIONS,
  type AudioItem,
  type CaptionItem,
  type CaptionStyle,
  type MediaItem,
  type TextItem,
  type Timeline,
  type TimelineItem,
} from "@clipkarya/core";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { EditorStore } from "./use-editor-store";
import type { EditorAsset } from "./types";

export function PropertiesPanel({ store, selected, assets }: { store: EditorStore; selected: TimelineItem | null; assets: Map<string, EditorAsset> }) {
  const patchItem = (patch: Partial<TimelineItem>, key: string) =>
    store.apply((d) => ({ ...d, items: d.items.map((i) => (i.id === selected?.id ? ({ ...i, ...patch } as TimelineItem) : i)) }), { coalesceKey: `${selected?.id}:${key}` });

  if (!selected) return <ProjectProperties store={store} />;
  return (
    <div className="space-y-5 p-4">
      <Section title="Waktu">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Mulai (dtk)" value={selected.start} min={0} step={0.1} onChange={(v) => patchItem({ start: v }, "start")} />
          <Num label="Durasi (dtk)" value={selected.duration} min={0.1} step={0.1} onChange={(v) => patchItem({ duration: v }, "duration")} />
        </div>
      </Section>
      {(selected.type === "video" || selected.type === "image") && <MediaProps item={selected} asset={assets.get(selected.assetId)} patch={patchItem} />}
      {selected.type === "audio" && <AudioProps item={selected} patch={patchItem} />}
      {selected.type === "text" && <TextProps item={selected} patch={patchItem} />}
      {selected.type === "caption" && <CaptionProps item={selected} patch={patchItem} />}
    </div>
  );
}

type Patch = (p: Partial<TimelineItem>, key: string) => void;

function MediaProps({ item, asset, patch }: { item: MediaItem; asset?: EditorAsset; patch: Patch }) {
  const crop = item.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  return (
    <>
      {item.type === "video" && (
        <Section title="Audio klip">
          <Num label="Mulai di sumber (dtk)" value={item.sourceIn} min={0} max={asset?.duration_sec ?? undefined} step={0.1} onChange={(v) => patch({ sourceIn: v }, "sourceIn")} />
          <Range label="Volume" value={item.volume} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ volume: v }, "volume")} />
          <Toggle label="Bisukan audio klip" checked={item.muted} onChange={(v) => patch({ muted: v }, "muted")} />
        </Section>
      )}
      <Section title="Bingkai">
        <Field label="Penyesuaian">
          <Select value={item.fit} onValueChange={(v) => patch({ fit: v as MediaItem["fit"] }, "fit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Isi bingkai (crop)</SelectItem>
              <SelectItem value="contain">Muat penuh (letterbox)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">Crop sumber</p>
        <Range label="Geser horizontal" value={crop.x} min={0} max={1 - crop.w} step={0.01} format={pct} onChange={(v) => patch({ crop: { ...crop, x: v } }, "crop")} />
        <Range label="Lebar crop" value={crop.w} min={0.1} max={1} step={0.01} format={pct} onChange={(v) => patch({ crop: { ...crop, w: v, x: Math.min(crop.x, 1 - v) } }, "crop")} />
        <Range label="Geser vertikal" value={crop.y} min={0} max={1 - crop.h} step={0.01} format={pct} onChange={(v) => patch({ crop: { ...crop, y: v } }, "crop")} />
        <Range label="Tinggi crop" value={crop.h} min={0.1} max={1} step={0.01} format={pct} onChange={(v) => patch({ crop: { ...crop, h: v, y: Math.min(crop.y, 1 - v) } }, "crop")} />
        <button className="text-xs text-primary hover:underline" onClick={() => patch({ crop: null }, "crop-reset")}>Reset crop</button>
      </Section>
      <Section title="Posisi di layar">
        <div className="grid grid-cols-2 gap-2">
          <Num label="X (%)" value={Math.round(item.rect.x * 100)} min={0} max={99} onChange={(v) => patch({ rect: { ...item.rect, x: v / 100 } }, "rect")} />
          <Num label="Y (%)" value={Math.round(item.rect.y * 100)} min={0} max={99} onChange={(v) => patch({ rect: { ...item.rect, y: v / 100 } }, "rect")} />
          <Num label="Lebar (%)" value={Math.round(item.rect.w * 100)} min={1} max={100} onChange={(v) => patch({ rect: { ...item.rect, w: v / 100 } }, "rect")} />
          <Num label="Tinggi (%)" value={Math.round(item.rect.h * 100)} min={1} max={100} onChange={(v) => patch({ rect: { ...item.rect, h: v / 100 } }, "rect")} />
        </div>
      </Section>
      <Section title="Transisi">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Masuk">
            <Select value={item.transitionIn} onValueChange={(v) => patch({ transitionIn: v as MediaItem["transitionIn"] }, "tin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Tidak ada</SelectItem><SelectItem value="fade">Fade</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Keluar">
            <Select value={item.transitionOut} onValueChange={(v) => patch({ transitionOut: v as MediaItem["transitionOut"] }, "tout")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Tidak ada</SelectItem><SelectItem value="fade">Fade</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
      </Section>
    </>
  );
}

function AudioProps({ item, patch }: { item: AudioItem; patch: Patch }) {
  return (
    <Section title="Audio">
      <Num label="Mulai di sumber (dtk)" value={item.sourceIn} min={0} step={0.1} onChange={(v) => patch({ sourceIn: v }, "sourceIn")} />
      <Range label="Volume" value={item.volume} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ volume: v }, "volume")} />
      <div className="grid grid-cols-2 gap-2">
        <Num label="Fade in (dtk)" value={item.fadeIn} min={0} max={10} step={0.1} onChange={(v) => patch({ fadeIn: v }, "fadeIn")} />
        <Num label="Fade out (dtk)" value={item.fadeOut} min={0} max={10} step={0.1} onChange={(v) => patch({ fadeOut: v }, "fadeOut")} />
      </div>
      <Toggle label="Ulangi (loop)" checked={item.loop} onChange={(v) => patch({ loop: v }, "loop")} />
      <Toggle label="Bisukan" checked={item.muted} onChange={(v) => patch({ muted: v }, "muted")} />
    </Section>
  );
}

function TextProps({ item, patch }: { item: TextItem; patch: Patch }) {
  const st = item.style;
  const set = (p: Partial<TextItem["style"]>, k: string) => patch({ style: { ...st, ...p } }, k);
  return (
    <Section title="Teks">
      <Textarea value={item.text} onChange={(e) => patch({ text: e.target.value }, "text")} maxLength={500} />
      <Field label="Font">
        <Select value={st.font} onValueChange={(v) => set({ font: v as TextItem["style"]["font"] }, "font")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CAPTION_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Range label="Ukuran" value={st.size} min={12} max={200} step={1} format={(v) => `${v}px`} onChange={(v) => set({ size: v }, "size")} />
      <div className="grid grid-cols-2 gap-2">
        <Color label="Warna" value={st.color} onChange={(v) => set({ color: v }, "color")} />
        <Color label={st.background ? "Latar" : "Outline"} value={st.background ? st.backgroundColor : st.outlineColor} onChange={(v) => set(st.background ? { backgroundColor: v } : { outlineColor: v }, "color2")} />
      </div>
      <Toggle label="Kotak latar" checked={st.background} onChange={(v) => set({ background: v }, "bg")} />
      <Toggle label="Tebal" checked={st.bold} onChange={(v) => set({ bold: v }, "bold")} />
      <Range label="Posisi horizontal" value={item.position.x} min={0} max={1} step={0.01} format={pct} onChange={(v) => patch({ position: { ...item.position, x: v } }, "pos")} />
      <Range label="Posisi vertikal" value={item.position.y} min={0} max={1} step={0.01} format={pct} onChange={(v) => patch({ position: { ...item.position, y: v } }, "pos")} />
    </Section>
  );
}

function CaptionProps({ item, patch }: { item: CaptionItem; patch: Patch }) {
  return (
    <Section title="Subtitle">
      <Textarea
        value={item.text}
        onChange={(e) => {
          const text = e.target.value;
          const tokens = text.split(/\s+/).filter(Boolean);
          // Keep word timings only when the word count is unchanged (pure spelling edits).
          const words = tokens.length === item.words.length ? item.words.map((w, i) => ({ ...w, text: tokens[i]! })) : [];
          patch({ text, words }, "text");
        }}
        maxLength={1000}
      />
      {!item.words.length && <p className="text-xs text-muted-foreground">Tanpa penanda waktu per kata: sorotan karaoke dinonaktifkan untuk baris ini.</p>}
      <p className="text-xs text-muted-foreground">Gaya subtitle diatur untuk seluruh proyek (klik area kosong).</p>
    </Section>
  );
}

function ProjectProperties({ store }: { store: EditorStore }) {
  const { doc } = store;
  const set = (p: Partial<Timeline>, k: string) => store.apply((d) => ({ ...d, ...p }), { coalesceKey: `project:${k}` });
  const cs = doc.captionStyle;
  const setCap = (p: Partial<CaptionStyle>, k: string) => set({ captionStyle: { ...cs, ...p } }, `cap:${k}`);
  return (
    <div className="space-y-5 p-4">
      <Section title="Proyek">
        <Field label="Rasio aspek">
          <Select value={doc.aspectRatio} onValueChange={(v) => set({ aspectRatio: v as Timeline["aspectRatio"] }, "ar")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Color label="Warna latar" value={doc.background} onChange={(v) => set({ background: v }, "bg")} />
      </Section>
      <Section title="Gaya subtitle">
        <Field label="Font">
          <Select value={cs.font} onValueChange={(v) => setCap({ font: v as CaptionStyle["font"] }, "font")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CAPTION_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Range label="Ukuran" value={cs.size} min={16} max={160} step={1} format={(v) => `${v}px`} onChange={(v) => setCap({ size: v }, "size")} />
        <div className="grid grid-cols-2 gap-2">
          <Color label="Warna teks" value={cs.color} onChange={(v) => setCap({ color: v }, "color")} />
          <Color label="Warna sorot" value={cs.highlightColor} onChange={(v) => setCap({ highlightColor: v }, "hl")} />
          <Color label="Outline" value={cs.outlineColor} onChange={(v) => setCap({ outlineColor: v }, "ol")} />
          <Color label="Latar" value={cs.backgroundColor} onChange={(v) => setCap({ backgroundColor: v }, "bgc")} />
        </div>
        <Range label="Tebal outline" value={cs.outlineWidth} min={0} max={12} step={1} format={(v) => `${v}px`} onChange={(v) => setCap({ outlineWidth: v }, "ow")} />
        <Field label="Posisi">
          <Select value={cs.position} onValueChange={(v) => setCap({ position: v as CaptionStyle["position"] }, "pos")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CAPTION_POSITIONS.map((p) => <SelectItem key={p} value={p}>{{ top: "Atas", middle: "Tengah", bottom: "Bawah" }[p]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Toggle label="Kotak latar" checked={cs.background} onChange={(v) => setCap({ background: v }, "bgon")} />
        {cs.background && <Range label="Opasitas latar" value={cs.backgroundOpacity} min={0} max={1} step={0.05} format={pct} onChange={(v) => setCap({ backgroundOpacity: v }, "bgo")} />}
        <Toggle label="Sorot kata (karaoke)" checked={cs.karaoke} onChange={(v) => setCap({ karaoke: v }, "kar")} />
        <Toggle label="HURUF KAPITAL" checked={cs.uppercase} onChange={(v) => setCap({ uppercase: v }, "up")} />
        <Toggle label="Tebal" checked={cs.bold} onChange={(v) => setCap({ bold: v }, "bold")} />
        <Num label="Maks. kata per baris (untuk subtitle baru)" value={cs.maxWordsPerCaption} min={1} max={12} onChange={(v) => setCap({ maxWordsPerCaption: Math.round(v) }, "mw")} />
      </Section>
      <Section title="Volume trek">
        {doc.tracks
          .filter((t) => t.kind === "video" || t.kind === "narration" || t.kind === "audio" || t.kind === "overlay")
          .map((t) => (
            <Range
              key={t.id}
              label={t.name}
              value={t.volume}
              min={0}
              max={2}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => store.apply((d) => ({ ...d, tracks: d.tracks.map((x) => (x.id === t.id ? { ...x, volume: v } : x)) }), { coalesceKey: `trackvol:${t.id}` })}
            />
          ))}
      </Section>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Num({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        className="h-8"
        onChange={(e) => {
          let v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onChange(v);
        }}
      />
    </Field>
  );
}
function Range({ label, value, onChange, min, max, step, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums text-muted-foreground">{format(value)}</span></div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v!)} />
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-input px-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </Field>
  );
}
