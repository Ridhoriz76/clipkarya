import { Captions, Film, Image as ImageIcon, Mic, Music2, Pause, Scissors, Type, Wand2 } from "lucide-react";

/** Illustrative (non-interactive) rendering of the editor layout for the landing page. */
export function EditorPreview() {
  const tracks = [
    { icon: Film, label: "Video", clips: [[0, 34, "bg-sky-500/70"], [35, 28, "bg-sky-500/70"], [64, 30, "bg-sky-500/70"]] },
    { icon: Type, label: "Teks", clips: [[2, 18, "bg-violet-500/60"]] },
    { icon: Mic, label: "Narasi", clips: [[4, 52, "bg-emerald-500/60"], [60, 30, "bg-emerald-500/60"]] },
    { icon: Music2, label: "Musik", clips: [[0, 94, "bg-amber-500/50"]] },
    { icon: Captions, label: "Subtitle", clips: [[4, 9, "bg-primary/70"], [14, 11, "bg-primary/70"], [26, 8, "bg-primary/70"], [36, 12, "bg-primary/70"], [50, 10, "bg-primary/70"], [62, 14, "bg-primary/70"], [78, 10, "bg-primary/70"]] },
  ] as const;
  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40" aria-label="Pratinjau editor">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate">Tips Diet Minggu Pertama · 9:16 · 1080p</span>
        <span className="ml-auto hidden rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground sm:inline">Ekspor MP4</span>
      </div>
      <div className="grid grid-cols-12">
        <div className="col-span-3 hidden space-y-2 border-r border-border p-3 md:block">
          {["Media", "Scene", "Teks", "Audio", "Subtitle"].map((t, i) => (
            <div key={t} className={`rounded-md px-2.5 py-1.5 text-xs ${i === 0 ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{t}</div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-video rounded-md bg-gradient-to-br from-zinc-600/60 to-zinc-800/80" />
            ))}
          </div>
        </div>
        <div className="col-span-12 flex items-center justify-center bg-black/30 p-6 md:col-span-6">
          <div className="relative aspect-[9/16] h-64 overflow-hidden rounded-lg bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 sm:h-80">
            <div className="absolute inset-x-6 top-1/4 h-1/3 rounded-full bg-amber-200/20 blur-2xl" />
            <div className="absolute left-3 right-3 top-6 text-center text-sm font-bold text-white drop-shadow">3 Kesalahan Diet</div>
            <div className="absolute bottom-16 left-0 right-0 text-center text-lg font-extrabold leading-tight text-white [text-shadow:0_2px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000]">
              KENAPA <span className="text-yellow-300">90%</span> ORANG
            </div>
          </div>
        </div>
        <div className="col-span-3 hidden space-y-3 border-l border-border p-3 text-xs md:block">
          <p className="font-medium">Properti caption</p>
          {["Font", "Ukuran", "Warna sorot", "Posisi"].map((l) => (
            <div key={l} className="flex items-center justify-between text-muted-foreground">
              <span>{l}</span>
              <span className="h-5 w-16 rounded bg-muted" />
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1.5 text-primary">
            <Wand2 className="size-3.5" /> Auto subtitle
          </div>
        </div>
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Pause className="size-3.5" /> <span>00:07.4 / 00:34.0</span>
          <Scissors className="ml-2 size-3.5" /> <ImageIcon className="size-3.5" />
        </div>
        <div className="relative space-y-1.5">
          <div className="absolute bottom-0 top-0 z-10 w-px bg-primary" style={{ left: "22%" }} />
          {tracks.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <t.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="relative h-5 flex-1 rounded bg-muted/50">
                {t.clips.map(([l, w, c], i) => (
                  <div key={i} className={`absolute top-0.5 bottom-0.5 rounded-sm ${c}`} style={{ left: `${l}%`, width: `${w}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
