"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { ProjectCard, type ProjectCardData } from "./project-card";

export function ProjectGrid({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<ProjectCardData | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => projects.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())), [projects, q]);

  const duplicate = async (p: ProjectCardData) => {
    try {
      await api(`/api/projects/${p.id}/duplicate`, { method: "POST" });
      toast.success("Proyek diduplikat.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/api/projects/${toDelete.id}`, { method: "DELETE" });
      toast.success("Proyek dan medianya dihapus.");
      setToDelete(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-input px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari proyek…" className="border-0 bg-transparent px-0 focus-visible:ring-0" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((p) => (
          <div key={p.id} className="relative">
            <ProjectCard p={p} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="secondary" className="absolute right-2 top-2 opacity-90" aria-label="Aksi proyek"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => duplicate(p)}><Copy /> Duplikat</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setToDelete(p)} className="text-destructive"><Trash2 /> Hapus</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus proyek?</DialogTitle>
            <DialogDescription>“{toDelete?.title}” beserta timeline, transkrip, klip, dan semua file media proyek ini akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>Hapus permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
