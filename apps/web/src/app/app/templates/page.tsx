import Link from "next/link";
import { ASPECT_RATIO_LABELS, TEMPLATES, type TemplatePreset } from "@clipkarya/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { NewProjectDialog } from "@/components/app/new-project-dialog";

/** Template formats that start from the AI script writer; the rest open straight into the editor. */
const SCRIPT_FORMAT: Partial<Record<TemplatePreset["format"], string>> = { script: "script", story: "story", listicle: "listicle" };

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader title="Template" description="Preset rasio, gaya subtitle, dan struktur scene. Semua bisa diubah setelah proyek dibuat." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TEMPLATES.map((t) => {
          const scriptFormat = SCRIPT_FORMAT[t.format];
          const s = t.captionStyle;
          return (
            <div key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex aspect-video items-end justify-center bg-gradient-to-br from-primary/25 via-zinc-800 to-zinc-950 p-4">
                <span
                  className="rounded px-2 text-center text-lg leading-tight"
                  style={{
                    fontFamily: s.font,
                    fontWeight: s.bold ? 800 : 500,
                    color: s.color,
                    textTransform: s.uppercase ? "uppercase" : "none",
                    WebkitTextStroke: `1px ${s.outlineColor}`,
                    paintOrder: "stroke fill",
                    background: s.background ? s.backgroundColor : undefined,
                  }}
                >
                  Contoh <span style={{ color: s.highlightColor }}>subtitle</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t.name}</p>
                  <Badge variant="outline">{ASPECT_RATIO_LABELS[t.aspectRatio]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <ol className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {t.sceneStructure.map((step, i) => (
                    <li key={step} className="rounded-md bg-muted px-1.5 py-0.5">{i + 1}. {step}</li>
                  ))}
                </ol>
                <div className="mt-auto pt-2">
                  {scriptFormat ? (
                    <Button asChild className="w-full" size="sm">
                      <Link href={`/app/create/script?format=${scriptFormat}&template=${t.id}`}>Gunakan template</Link>
                    </Button>
                  ) : (
                    <NewProjectDialog mode="editor" title={t.name} templateId={t.id}>
                      <Button className="w-full" size="sm">Gunakan template</Button>
                    </NewProjectDialog>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
