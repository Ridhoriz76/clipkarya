import { AppShell } from "@/components/app/app-shell";
import { Notice } from "@/components/ui/misc";
import { getAccountSummary } from "@/lib/account";
import { getProfile, requireUser } from "@/lib/auth";
import { APP_NAME, FREE_MODE, isSupabaseConfigured } from "@/lib/env";
import { getDictionary } from "@/lib/i18n";

// Per-user pages that also read server env (provider keys) at request time; never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <Notice variant="warning" title="Konfigurasi diperlukan">
          Supabase belum dikonfigurasi. Salin <code>.env.example</code> ke <code>apps/web/.env.local</code> dan isi kredensial Supabase. Lihat README.
        </Notice>
      </div>
    );
  }
  const user = await requireUser();
  const [profile, account] = await Promise.all([getProfile(), FREE_MODE ? null : getAccountSummary()]);
  const t = getDictionary(profile?.locale);
  return (
    <AppShell
      appName={APP_NAME}
      t={t}
      user={{ name: profile?.full_name || user.email?.split("@")[0] || "Pengguna", email: user.email, isAdmin: profile?.role === "admin" }}
      credits={account?.credits ?? null}
      planName={account?.plan?.name ?? null}
    >
      {children}
    </AppShell>
  );
}
