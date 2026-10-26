import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Notice } from "@/components/ui/misc";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid pointer-events-none fixed inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {!isSupabaseConfigured() && (
            <div className="mb-4">
              <Notice variant="warning" title="Supabase belum dikonfigurasi">
                Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local. Lihat README.
              </Notice>
            </div>
          )}
          {children}
        </div>
      </main>
      <footer className="relative py-6 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">Syarat</Link> · <Link href="/privacy" className="hover:text-foreground">Privasi</Link>
      </footer>
    </div>
  );
}
