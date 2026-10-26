"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ASPECT_RATIO_LABELS, ASPECT_RATIOS, TEMPLATES } from "@clipkarya/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";

export function NewProjectDialog({ mode, title, templateId, children }: { mode: string; title: string; templateId?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>(TEMPLATES.find((t) => t.id === templateId)?.aspectRatio ?? "9:16");
  const [resolution, setResolution] = useState("1080p");
  const [template, setTemplate] = useState(templateId ?? "none");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        json: { title: name || title, mode, aspectRatio, resolution, templateId: template === "none" ? undefined : template },
      });
      router.push(`/app/projects/${id}/edit`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Atur format proyek. Anda bisa mengubahnya nanti di editor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Nama proyek</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder={title} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rasio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{ASPECT_RATIO_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resolusi</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa template</SelectItem>
                {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={create} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Buat proyek</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
