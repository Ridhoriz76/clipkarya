"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/client-api";

export type AdminPlan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  monthly_credits: number;
  max_upload_mb: number;
  max_export_resolution: "720p" | "1080p";
  is_active: boolean;
  features: string[];
};

export function PlanEditor({ plan }: { plan: AdminPlan }) {
  const router = useRouter();
  const [p, setP] = useState(plan);
  const [features, setFeatures] = useState(plan.features.join("\n"));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const { id, ...rest } = p;
      await api(`/api/admin/plans/${id}`, { method: "PUT", json: { ...rest, features: features.split("\n").map((f) => f.trim()).filter(Boolean) } });
      toast.success(`Paket ${p.name} disimpan.`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const num = (k: "price_cents" | "monthly_credits" | "max_upload_mb") => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{plan.name} <span className="font-mono text-xs text-muted-foreground">{plan.id}</span></CardTitle>
        <label className="flex items-center gap-2 text-xs">Aktif <Switch checked={p.is_active} onCheckedChange={(c) => setP({ ...p, is_active: c })} /></label>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Nama</Label><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Harga (Rupiah)</Label><Input type="number" min={0} value={p.price_cents / 100} onChange={(e) => setP({ ...p, price_cents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) })} /></div>
          <div className="space-y-1"><Label>Kredit/bulan</Label><Input type="number" min={0} value={p.monthly_credits} onChange={num("monthly_credits")} /></div>
          <div className="space-y-1"><Label>Upload maks (MB)</Label><Input type="number" min={10} max={2048} value={p.max_upload_mb} onChange={num("max_upload_mb")} /></div>
        </div>
        <div className="space-y-1">
          <Label>Resolusi ekspor maks</Label>
          <Select value={p.max_export_resolution} onValueChange={(v) => setP({ ...p, max_export_resolution: v as "720p" | "1080p" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="720p">720p</SelectItem><SelectItem value="1080p">1080p</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Deskripsi</Label><Input value={p.description} maxLength={300} onChange={(e) => setP({ ...p, description: e.target.value })} /></div>
        <div className="space-y-1"><Label>Fitur (satu per baris)</Label><Textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} /></div>
        <Button size="sm" onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Simpan</Button>
      </CardContent>
    </Card>
  );
}

export function UserPlanSelect({ userId, current, plans }: { userId: string; current: string | null; plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const change = async (planId: string) => {
    if (planId === current) return;
    if (!confirm("Ubah paket pengguna ini? Kredit bulanan paket baru akan langsung ditambahkan.")) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}`, { method: "PUT", json: { planId } });
      toast.success("Paket diubah.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Select value={current ?? undefined} onValueChange={change} disabled={busy}>
      <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Tanpa paket" /></SelectTrigger>
      <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function CreditGrantForm() {
  const [f, setF] = useState({ email: "", amount: 10, reason: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ balance: number }>("/api/admin/credits", { method: "POST", json: f });
      toast.success(`Kredit disesuaikan. Saldo baru: ${r.balance}.`);
      setF({ email: "", amount: 10, reason: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Sesuaikan kredit</CardTitle>
        <CardDescription>Nilai negatif untuk mengurangi. Tercatat di riwayat kredit pengguna.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="g-email">Email pengguna</Label><Input id="g-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="g-amount">Jumlah</Label><Input id="g-amount" type="number" required value={f.amount} onChange={(e) => setF({ ...f, amount: Math.round(Number(e.target.value)) || 0 })} /></div>
          <div className="space-y-1"><Label htmlFor="g-reason">Alasan</Label><Input id="g-reason" required minLength={3} maxLength={200} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <Button type="submit" disabled={busy || f.amount === 0}>{busy && <Loader2 className="animate-spin" />} Terapkan</Button>
        </form>
      </CardContent>
    </Card>
  );
}
