import Link from "next/link";
import { Check, Coins, History } from "lucide-react";
import { CREDIT_COSTS, FREE_DAILY_LIMITS } from "@clipkarya/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { getAccountSummary } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { FREE_MODE } from "@/lib/env";
import { getPlans } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatPrice } from "@/lib/utils";

type Tx = { id: string; amount: number; kind: string; reason: string; balance_after: number; created_at: string };
type Usage = { id: string; provider: string; operation: string; model: string | null; units: number; unit_type: string; credits: number; is_demo: boolean; created_at: string };

const KIND_LABEL: Record<string, string> = { grant: "Pemberian", spend: "Pemakaian", refund: "Pengembalian", adjustment: "Penyesuaian", expire: "Kedaluwarsa" };

const COST_TABLE = [
  ["Transkripsi", `${CREDIT_COSTS.transcriptionPerMinute} kredit / menit audio`],
  ["Analisis klip", `${CREDIT_COSTS.clipAnalysis} kredit / analisis`],
  ["Voiceover", `${CREDIT_COSTS.voicePer500Chars} kredit / 500 karakter`],
  ["Naskah AI", `${CREDIT_COSTS.script} kredit / naskah`],
  ["Gambar AI", `${CREDIT_COSTS.imageEach} kredit / gambar`],
  ["Video AI", `${CREDIT_COSTS.videoPerSecond} kredit / detik video`],
  ["Ekspor 720p", `${CREDIT_COSTS.renderPerMinute720} kredit / menit`],
  ["Ekspor 1080p", `${CREDIT_COSTS.renderPerMinute1080} kredit / menit`],
] as const;

const LIMIT_LABELS: [keyof typeof FREE_DAILY_LIMITS, string][] = [
  ["transcription", "Transkripsi"],
  ["clip_analysis", "Analisis klip"],
  ["script", "Naskah AI"],
  ["voice", "Voiceover"],
  ["image", "Gambar AI (permintaan)"],
  ["video", "Video AI"],
  ["render", "Ekspor video"],
];

export default async function UsagePage() {
  await requireUser();
  const supabase = await createClient();
  if (FREE_MODE) return <FreeUsage supabase={supabase} />;
  const [account, plans, { data: txs }, { data: usage }] = await Promise.all([
    getAccountSummary(),
    getPlans(),
    supabase.from("credit_transactions").select("id, amount, kind, reason, balance_after, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("usage_logs").select("id, provider, operation, model, units, unit_type, credits, is_demo, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

  return (
    <div className="space-y-8">
      <PageHeader title="Penggunaan & Kredit" description="Saldo kredit, riwayat transaksi, dan pemakaian penyedia AI." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="size-4" /> Saldo kredit</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{account.credits}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Paket aktif</p>
          <p className="mt-2 text-2xl font-semibold">{account.plan?.name ?? "–"}</p>
          {account.plan && <p className="mt-1 text-xs text-muted-foreground">{account.plan.monthly_credits} kredit/bulan · ekspor maks {account.plan.max_export_resolution}</p>}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Periode berikutnya</p>
          <p className="mt-2 text-2xl font-semibold">{account.periodEnd ? formatDate(account.periodEnd) : "–"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Kredit bulanan ditambahkan saat periode diperbarui.</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Paket</h2>
        <div className="mb-4">
          <Notice title="Pembayaran online belum aktif">
            Pembayaran belum terhubung di versi ini. Untuk upgrade, hubungi <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>; admin dapat mengubah paket Anda secara manual.
          </Notice>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = account.plan?.id === p.id;
            return (
              <Card key={p.id} className={cn("flex flex-col", current && "border-primary")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {current && <Badge>Aktif</Badge>}
                  </div>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-2xl font-semibold">
                    {formatPrice(p.price_cents, p.currency)}
                    {p.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground"> /bulan</span>}
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{f}</li>
                    ))}
                  </ul>
                  {!current && p.price_cents > 0 && (
                    <Button asChild variant="outline" className="mt-auto">
                      <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Upgrade ke paket ${p.name}`)}`}>Minta upgrade</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 font-semibold">Riwayat kredit</h2>
          {txs?.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Keterangan</th><th className="px-3 py-2 text-right">Jumlah</th><th className="px-3 py-2 text-right">Saldo</th></tr>
                </thead>
                <tbody>
                  {(txs as Tx[]).map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(t.created_at)}</td>
                      <td className="px-3 py-2"><span className="mr-2 text-xs text-muted-foreground">{KIND_LABEL[t.kind] ?? t.kind}</span>{t.reason}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", t.amount > 0 ? "text-emerald-500" : "text-foreground")}>{t.amount > 0 ? `+${t.amount}` : t.amount}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{t.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={History} title="Belum ada transaksi" />
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Biaya kredit</CardTitle>
            <CardDescription>Kredit dipotong saat pekerjaan dimulai dan dikembalikan otomatis jika gagal atau dibatalkan.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {COST_TABLE.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Pemakaian penyedia AI</h2>
        {usage?.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Operasi</th><th className="px-3 py-2">Penyedia / model</th><th className="px-3 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Kredit</th></tr>
              </thead>
              <tbody>
                {(usage as Usage[]).map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                    <td className="px-3 py-2">{u.operation} {u.is_demo && <Badge variant="demo" className="ml-1">DEMO</Badge>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.provider}{u.model ? ` · ${u.model}` : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(u.units * 100) / 100} {u.unit_type}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pemakaian. <Link href="/app/create" className="underline">Buat video pertama Anda.</Link></p>
        )}
      </section>
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

/** Free mode: no plans or credits, just today's fair-use counters and the provider usage log. */
async function FreeUsage({ supabase }: { supabase: Supabase }) {
  const since = hoursAgo(24);
  const [{ data: aiJobs }, { count: renders }, { data: usage }] = await Promise.all([
    supabase.from("ai_generation_jobs").select("type").gte("created_at", since).neq("status", "canceled"),
    supabase.from("render_jobs").select("id", { count: "exact", head: true }).gte("created_at", since).neq("status", "canceled"),
    supabase.from("usage_logs").select("id, provider, operation, model, units, unit_type, credits, is_demo, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const used: Record<string, number> = { render: renders ?? 0 };
  for (const j of (aiJobs ?? []) as { type: string }[]) used[j.type] = (used[j.type] ?? 0) + 1;

  return (
    <div className="space-y-8">
      <PageHeader title="Penggunaan" description="Semua fitur gratis. Agar adil untuk semua pengguna, setiap fitur punya batas pemakaian per 24 jam." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LIMIT_LABELS.map(([key, label]) => {
          const n = used[key] ?? 0;
          const limit = FREE_DAILY_LIMITS[key];
          return (
            <Card key={key} className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {n}
                <span className="text-sm font-normal text-muted-foreground"> / {limit}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", n >= limit ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, (n / limit) * 100)}%` }} />
              </div>
            </Card>
          );
        })}
      </div>
      <section>
        <h2 className="mb-3 font-semibold">Pemakaian penyedia AI</h2>
        {usage?.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Operasi</th><th className="px-3 py-2">Penyedia / model</th><th className="px-3 py-2 text-right">Unit</th></tr>
              </thead>
              <tbody>
                {(usage as Usage[]).map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                    <td className="px-3 py-2">{u.operation} {u.is_demo && <Badge variant="demo" className="ml-1">DEMO</Badge>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.provider}{u.model ? ` · ${u.model}` : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(u.units * 100) / 100} {u.unit_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={History} title="Belum ada pemakaian" description="Hasil AI dan ekspor Anda akan tercatat di sini." />
        )}
      </section>
    </div>
  );
}
