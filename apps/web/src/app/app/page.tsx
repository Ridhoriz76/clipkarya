import Link from "next/link";
import { Captions, Clapperboard, Coins, FileText, FolderKanban, Images, Mic, Plus, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ProjectCard } from "@/components/app/project-card";
import { RecentActivity } from "@/components/app/recent-activity";
import { getAccountSummary } from "@/lib/account";
import { FREE_MODE } from "@/lib/env";
import { getProfile } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { listProjects } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

const quickTools = [
  { href: "/app/create/auto-clip", label: "Auto-clip video panjang", icon: Scissors },
  { href: "/app/tools/transcriber", label: "Transkripsi & subtitle", icon: Captions },
  { href: "/app/tools/voiceover", label: "Voiceover AI", icon: Mic },
  { href: "/app/create/script", label: "Naskah ke video", icon: FileText },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const [profile, account, projects, projectCount, exportCount, mediaCount, aiCount] = await Promise.all([
    getProfile(),
    FREE_MODE ? null : getAccountSummary(),
    listProjects(8),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("render_jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("status", "ready").neq("kind", "thumbnail"),
    supabase.from("ai_generation_jobs").select("id", { count: "exact", head: true }).eq("status", "completed").neq("type", "probe"),
  ]);
  const t = getDictionary(profile?.locale);
  const stats = [
    { label: t.dashboard.projects, value: projectCount.count ?? 0, icon: FolderKanban },
    { label: t.dashboard.exports, value: exportCount.count ?? 0, icon: Clapperboard },
    ...(account
      ? [
          { label: t.dashboard.credits, value: account.credits, icon: Coins, href: "/app/usage" },
          { label: t.dashboard.plan, value: account.plan?.name ?? "–", icon: Sparkles, href: "/app/usage" },
        ]
      : [
          { label: "Media", value: mediaCount.count ?? 0, icon: Images },
          { label: "Hasil AI", value: aiCount.count ?? 0, icon: Sparkles, href: "/app/usage" },
        ]),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.dashboard.greeting}, {profile?.full_name?.split(" ")[0] ?? ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/app/create"><Plus /> {t.dashboard.newVideo}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <Card className="h-full p-4 transition-colors hover:border-primary/30">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {s.label}
                <s.icon className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          );
          return s.href ? <Link key={s.label} href={s.href}>{inner}</Link> : <div key={s.label}>{inner}</div>;
        })}
      </div>
      {account && account.credits < 5 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm">Kredit Anda hampir habis. Upgrade paket untuk terus membuat video.</p>
          <Button asChild size="sm"><Link href="/app/usage">Lihat paket</Link></Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t.dashboard.recent}</h2>
            <Link href="/app/projects" className="text-sm text-muted-foreground hover:text-foreground">Lihat semua</Link>
          </div>
          {projects.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => <ProjectCard key={p.id} p={p} />)}
            </div>
          ) : (
            <EmptyState icon={FolderKanban} title="Belum ada proyek" description={t.dashboard.empty} action={<Button asChild><Link href="/app/create">{t.dashboard.newVideo}</Link></Button>} />
          )}
        </section>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t.dashboard.quickTools}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {quickTools.map((q) => (
                <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent">
                  <q.icon className="size-4 text-primary" /> {q.label}
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.dashboard.activity}</CardTitle></CardHeader>
            <CardContent><RecentActivity /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
