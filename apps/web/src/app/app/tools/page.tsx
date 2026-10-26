import Link from "next/link";
import { capabilityAvailability } from "@clipkarya/core/providers";
import { AudioLines, Captions, Image as ImageIcon, Mic, Scissors, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";

const tools = [
  { href: "/app/tools/transcriber", title: "Transkripsi Video", desc: "Transkrip, penanda waktu, SRT/VTT.", icon: Captions, cap: "transcription" },
  { href: "/app/tools/voiceover", title: "Voiceover AI", desc: "Teks menjadi suara dari pustaka penyedia.", icon: Mic, cap: "speech" },
  { href: "/app/tools/image", title: "Gambar AI", desc: "Visual dan thumbnail dari prompt.", icon: ImageIcon, cap: "image" },
  { href: "/app/tools/video", title: "Video AI", desc: "Klip video dari prompt teks.", icon: AudioLines, cap: "video" },
  { href: "/app/create/auto-clip", title: "Auto-clip", desc: "Kandidat klip pendek dari video panjang.", icon: Scissors, cap: "transcription" },
  { href: "/app/create/script", title: "Penulis naskah", desc: "Naskah per scene untuk video pendek.", icon: FileText, cap: "text" },
] as const;

export default function ToolsPage() {
  const caps = capabilityAvailability();
  return (
    <div>
      <PageHeader title="AI Tools" description="Alat individual. Semua hasil tersimpan di pustaka media Anda." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((t) => {
          const c = caps[t.cap];
          return (
            <Link key={t.href} href={t.href} className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><t.icon className="size-5" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.title}</p>
                  {!c.available && <Badge variant="outline">Perlu API key</Badge>}
                  {c.demoOnly && <Badge variant="demo">DEMO</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
