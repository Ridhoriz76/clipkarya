import { TEMPLATES } from "@clipkarya/core";
import { capabilityAvailability } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { ScriptForm } from "./form";

const TITLES = {
  script: { title: "Naskah ke Video", desc: "Dari topik menjadi hook, naskah per scene, voiceover, dan subtitle." },
  story: { title: "Text Story", desc: "Cerita faceless dengan hook, alur, dan penutup yang kuat." },
  listicle: { title: "Ranking / Listicle", desc: "Hitung mundur dengan satu scene per item. Berikan sumber agar klaim dapat dipertanggungjawabkan." },
} as const;

export default async function ScriptCreatePage({ searchParams }: { searchParams: Promise<{ format?: string; template?: string }> }) {
  const { format: f, template: tpl } = await searchParams;
  const template = TEMPLATES.find((t) => t.id === tpl);
  const format = (f === "story" || f === "listicle" ? f : "script") as keyof typeof TITLES;
  const caps = capabilityAvailability();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={template ? `${TITLES[format].title} · ${template.name}` : TITLES[format].title} description={TITLES[format].desc} />
      {!caps.text.available && (
        <div className="mb-4">
          <Notice variant="warning" title="Penyedia teks belum dikonfigurasi">
            Pembuatan naskah AI memerlukan ANTHROPIC_API_KEY atau OPENAI_API_KEY. Mode demo tidak membuat naskah palsu. Anda tetap bisa menulis scene secara manual setelah membuat proyek.
          </Notice>
        </div>
      )}
      <ScriptForm format={format} templateId={template?.id} defaultAspectRatio={template?.aspectRatio} textAvailable={caps.text.available} />
    </div>
  );
}
