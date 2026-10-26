import Link from "next/link";
import { Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { id as dict } from "@/lib/i18n/id";

export type ProjectCardData = {
  id: string;
  title: string;
  status: string;
  mode: string;
  aspect_ratio: string;
  updated_at: string;
  thumbnailUrl: string | null;
};

const MODE_LABEL: Record<string, string> = {
  editor: "Editor",
  auto_clip: "Auto-clip",
  script_to_video: "Naskah ke video",
  text_story: "Cerita",
  video_story: "Video story",
  commentary: "Komentar",
  split_screen: "Split-screen",
  listicle: "Ranking",
  transcriber: "Transkripsi",
};

export function projectHref(p: { id: string; mode: string }) {
  if (p.mode === "auto_clip") return `/app/projects/${p.id}`;
  if (p.mode === "script_to_video" || p.mode === "text_story" || p.mode === "listicle") return `/app/projects/${p.id}`;
  if (p.mode === "transcriber") return `/app/projects/${p.id}`;
  return `/app/projects/${p.id}/edit`;
}

export function ProjectCard({ p }: { p: ProjectCardData }) {
  return (
    <Link href={projectHref(p)} className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="relative aspect-video overflow-hidden bg-muted">
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnailUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center"><Film className="size-6 text-muted-foreground/60" /></div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{p.aspect_ratio}</span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-sm font-medium">{p.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1.5 py-0">{MODE_LABEL[p.mode] ?? p.mode}</Badge>
          <span>{dict.status[p.status as keyof typeof dict.status] ?? p.status}</span>
          <span className="ml-auto">{formatRelative(p.updated_at)}</span>
        </div>
      </div>
    </Link>
  );
}
