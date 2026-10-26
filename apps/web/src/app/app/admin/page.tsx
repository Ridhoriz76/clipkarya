import { providerStatuses } from "@clipkarya/core/providers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth";
import { FREE_MODE } from "@/lib/env";
import { queueHealth } from "@/lib/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { CreditGrantForm, PlanEditor, UserPlanSelect, type AdminPlan } from "./forms";

type JobRow = { id: string; type?: string; status: string; error_message: string | null; created_at: string; user_id: string };
type UserRow = { id: string; email: string | null; full_name: string | null; role: string; created_at: string; user_subscriptions: { plan_id: string; status: string }[] };

const STATUSES = ["queued", "processing", "completed", "failed", "canceled"] as const;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const since = hoursAgo(24);

  const countBy = async (table: "ai_generation_jobs" | "render_jobs") =>
    Object.fromEntries(
      await Promise.all(
        STATUSES.map(async (s) => {
          const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("status", s).gte("created_at", since);
          return [s, count ?? 0] as const;
        }),
      ),
    ) as Record<(typeof STATUSES)[number], number>;

  const [aiCounts, renderCounts, queues, { data: failedAi }, { data: failedRender }, { data: plans }, { data: users }] = await Promise.all([
    countBy("ai_generation_jobs"),
    countBy("render_jobs"),
    queueHealth(),
    admin.from("ai_generation_jobs").select("id, type, status, error_message, created_at, user_id").eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    admin.from("render_jobs").select("id, status, error_message, created_at, user_id").eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    admin.from("subscription_plans").select("id, name, description, price_cents, monthly_credits, max_upload_mb, max_export_resolution, is_active, features").order("sort_order"),
    admin.from("profiles").select("id, email, full_name, role, created_at, user_subscriptions(plan_id, status)").order("created_at", { ascending: false }).limit(50),
  ]);
  const providers = providerStatuses();
  const planOptions = ((plans ?? []) as AdminPlan[]).map((p) => ({ id: p.id, name: p.name }));
  const failed = [...((failedAi ?? []) as JobRow[]).map((j) => ({ ...j, kind: `AI · ${j.type}` })), ...((failedRender ?? []) as JobRow[]).map((j) => ({ ...j, kind: "Render" }))]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" description={FREE_MODE ? "Status penyedia, antrean, dan pengguna. Mode gratis aktif (NEXT_PUBLIC_FREE_MODE)." : "Status penyedia, antrean, paket, dan kredit pengguna. Semua aksi diotorisasi di server."} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penyedia AI</CardTitle>
            <CardDescription>Dibaca dari variabel lingkungan server. Kunci API tidak pernah dikirim ke browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {providers.map((p, i) => (
                <li key={`${p.id}-${p.capability}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p>{p.label}</p>
                    {p.model && <p className="truncate text-xs text-muted-foreground">{p.model}</p>}
                    {!p.configured && <p className="text-xs text-muted-foreground">Perlu: {p.missingEnv.join(", ")}</p>}
                  </div>
                  {p.isDemo ? <Badge variant="demo">DEMO</Badge> : p.configured ? <Badge>Aktif</Badge> : <Badge variant="outline">Belum dikonfigurasi</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pekerjaan (24 jam) & antrean</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <table className="w-full">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Jenis</th>{STATUSES.map((s) => <th key={s} className="py-1 text-right">{s}</th>)}</tr>
              </thead>
              <tbody className="tabular-nums">
                <tr><td className="py-1">AI</td>{STATUSES.map((s) => <td key={s} className="py-1 text-right">{aiCounts[s]}</td>)}</tr>
                <tr><td className="py-1">Render</td>{STATUSES.map((s) => <td key={s} className="py-1 text-right">{renderCounts[s]}</td>)}</tr>
              </tbody>
            </table>
            <div className="space-y-1">
              {queues.map((q) => (
                <p key={q.name} className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{q.name}</span>
                  {"error" in q ? (
                    <span className="text-xs text-destructive">{q.error}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">menunggu {q.counts.waiting ?? 0} · aktif {q.counts.active ?? 0} · tertunda {q.counts.delayed ?? 0} · gagal {q.counts.failed ?? 0}</span>
                  )}
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Kegagalan terbaru</p>
              {failed.length ? (
                <ul className="space-y-1 text-xs">
                  {failed.map((j) => (
                    <li key={j.id} className="flex gap-2">
                      <span className="shrink-0 text-muted-foreground">{formatDate(j.created_at)}</span>
                      <span className="shrink-0 font-medium">{j.kind}</span>
                      <span className="truncate">{j.error_message ?? "–"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Tidak ada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {!FREE_MODE && (
      <section>
        <h2 className="mb-3 font-semibold">Paket</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {((plans ?? []) as AdminPlan[]).map((p) => <PlanEditor key={p.id} plan={p} />)}
        </div>
      </section>
      )}

      <section className={FREE_MODE ? "" : "grid gap-6 lg:grid-cols-[1fr_340px]"}>
        <div>
          <h2 className="mb-3 font-semibold">Pengguna terbaru</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Pengguna</th><th className="px-3 py-2">Bergabung</th>{!FREE_MODE && <th className="px-3 py-2">Paket</th>}</tr>
              </thead>
              <tbody>
                {((users ?? []) as UserRow[]).map((u) => {
                  const live = u.user_subscriptions.find((s) => ["active", "trialing", "past_due"].includes(s.status));
                  return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <p>{u.full_name || "–"} {u.role === "admin" && <Badge variant="outline" className="ml-1">admin</Badge>}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                      {!FREE_MODE && <td className="px-3 py-2"><UserPlanSelect userId={u.id} current={live?.plan_id ?? null} plans={planOptions} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {!FREE_MODE && <CreditGrantForm />}
      </section>
    </div>
  );
}
