import Link from "next/link";
import { capabilityAvailability } from "@clipkarya/core/providers";
import {
  AudioLines,
  BookOpenText,
  Captions,
  Clapperboard,
  Columns2,
  FileText,
  Film,
  Image as ImageIcon,
  ListOrdered,
  MessageSquareQuote,
  Mic,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { NewProjectDialog } from "@/components/app/new-project-dialog";

type Mode = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  mode?: string;
  needs?: "text" | "transcription" | "speech" | "image" | "video";
};

const modes: Mode[] = [
  { key: "auto-clip", title: "Auto-clip / AI Shorts", description: "Unggah video panjang, dapatkan kandidat klip pendek dengan skor yang dapat dijelaskan.", icon: Scissors, href: "/app/create/auto-clip", needs: "transcription" },
  { key: "script", title: "Naskah ke Video", description: "Dari topik menjadi hook, naskah per scene, voiceover, dan subtitle.", icon: FileText, href: "/app/create/script?format=script", needs: "text" },
  { key: "story", title: "Text Story", description: "Cerita faceless dengan hook, alur, dan penutup.", icon: BookOpenText, href: "/app/create/script?format=story", needs: "text" },
  { key: "listicle", title: "Ranking / Listicle", description: "Video hitung mundur dengan satu scene per item. Klaim yang perlu bukti ditandai.", icon: ListOrdered, href: "/app/create/script?format=listicle", needs: "text" },
  { key: "editor", title: "Editor kosong", description: "Mulai dari timeline kosong dan susun media Anda sendiri.", icon: Clapperboard, mode: "editor" },
  { key: "video-story", title: "Video Story", description: "Unggah footage Anda lalu susun menjadi cerita di editor, lengkap dengan narasi dan subtitle.", icon: Film, mode: "video_story" },
  { key: "commentary", title: "Komentar / Reaksi", description: "Video utama + video sekunder dengan layout split dan narasi Anda.", icon: MessageSquareQuote, mode: "commentary" },
  { key: "split", title: "Split-screen", description: "Atas/bawah, kiri/kanan, atau picture-in-picture.", icon: Columns2, mode: "split_screen" },
  { key: "transcriber", title: "Transkripsi Video", description: "Transkrip dengan penanda waktu, SRT, dan VTT.", icon: Captions, href: "/app/tools/transcriber", needs: "transcription" },
  { key: "voiceover", title: "Voiceover AI", description: "Ubah teks menjadi suara dari pustaka penyedia.", icon: Mic, href: "/app/tools/voiceover", needs: "speech" },
  { key: "image", title: "Gambar AI", description: "Hasilkan gambar untuk scene dan thumbnail.", icon: ImageIcon, href: "/app/tools/image", needs: "image" },
  { key: "video", title: "Video AI", description: "Hasilkan klip video dari prompt teks.", icon: AudioLines, href: "/app/tools/video", needs: "video" },
];

export default function CreateHubPage() {
  const caps = capabilityAvailability();
  return (
    <div>
      <PageHeader title="Buat Video" description="Pilih mode pembuatan. Setiap mode berakhir di editor dan ekspor MP4." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modes.map((m) => {
          const cap = m.needs ? caps[m.needs] : null;
          const badge = cap ? (cap.available ? (cap.demoOnly ? <Badge variant="demo">DEMO</Badge> : null) : <Badge variant="outline">Perlu API key</Badge>) : null;
          const body = (
            <div className="flex h-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <m.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.title}</p>
                  {badge}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              </div>
            </div>
          );
          if (m.href) return <Link key={m.key} href={m.href}>{body}</Link>;
          return (
            <NewProjectDialog key={m.key} mode={m.mode!} title={m.title}>
              <button type="button" className="h-full w-full">{body}</button>
            </NewProjectDialog>
          );
        })}
      </div>
    </div>
  );
}
