import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

const links = [
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#fitur", label: "Fitur" },
  { href: "/#faq", label: "FAQ" },
];

export async function SiteHeader() {
  const user = isSupabaseConfigured() ? await getUser() : null;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Utama">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/app">Buka dasbor</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Masuk</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Mulai gratis</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
