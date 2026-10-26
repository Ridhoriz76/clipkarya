"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SettingsForm({ email, fullName, locale, personal }: { email: string; fullName: string; locale: "id" | "en"; personal: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(fullName);
  const [lang, setLang] = useState(locale);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", json: { full_name: name.trim() || undefined, locale: lang } });
      toast.success("Profil disimpan.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 8) return toast.error("Kata sandi minimal 8 karakter.");
    if (pw.next !== pw.confirm) return toast.error("Konfirmasi kata sandi tidak cocok.");
    setPwBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    setPw({ next: "", confirm: "" });
    toast.success("Kata sandi diperbarui.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bahasa antarmuka</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as "id" | "en")}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Navigasi dan dasbor sudah tersedia dalam bahasa Inggris; halaman lain menyusul.</p>
          </div>
          <Button onClick={saveProfile} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Simpan profil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tampilan</CardTitle>
          <CardDescription>Disimpan di perangkat ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["dark", "Gelap", Moon],
              ["light", "Terang", Sun],
              ["system", "Sistem", Monitor],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn("flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/40", theme === value && "border-primary bg-primary/5")}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keamanan</CardTitle>
          <CardDescription>{personal ? "Mode pribadi: kata sandi diatur lewat variabel APP_PASSWORD di server." : "Ganti kata sandi akun Anda."}</CardDescription>
        </CardHeader>
        {!personal && (
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pw1">Kata sandi baru</Label>
              <Input id="pw1" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Konfirmasi</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </div>
          </div>
          <Button variant="outline" onClick={changePassword} disabled={pwBusy}>{pwBusy && <Loader2 className="animate-spin" />} Ganti kata sandi</Button>
        </CardContent>
        )}
      </Card>
    </div>
  );
}
