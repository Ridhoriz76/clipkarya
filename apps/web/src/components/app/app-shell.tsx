"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronsLeft, Coins, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { navItems } from "./nav";
import type { Dictionary } from "@/lib/i18n";

type Props = {
  appName: string;
  t: Dictionary;
  user: { name: string; email: string | null; isAdmin: boolean };
  /** null in free mode: the credit badge is hidden. */
  credits: number | null;
  planName: string | null;
  children: React.ReactNode;
};

export function AppShell({ appName, t, user, credits, planName, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navItems(t, user.isAdmin);
  // The editor uses the full viewport.
  const fullBleed = /^\/app\/projects\/[^/]+\/edit/.test(pathname);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ck.sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ck.sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const nav = (compact: boolean) => (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 py-3 scrollbar-thin" aria-label="Navigasi aplikasi">
      {groups.map((g, gi) => (
        <ul key={gi} className="space-y-0.5">
          {g.map((item) => {
            const link = (
              <Link
                href={item.href}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
                  isActive(item.href) ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  compact && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", isActive(item.href) && "text-primary")} />
                {!compact && <span className="truncate">{item.label}</span>}
              </Link>
            );
            return (
              <li key={item.href}>
                {compact ? (
                  <Tooltip content={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );

  if (fullBleed) return <div className="h-dvh">{children}</div>;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn("hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-16" : "w-60")}>
        <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
          <Link href="/app" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark />
            {!collapsed && <span className="truncate">{appName}</span>}
          </Link>
        </div>
        {nav(collapsed)}
        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className={cn("w-full justify-start text-muted-foreground", collapsed && "justify-center")} onClick={toggle} aria-label="Ciutkan sidebar">
            <ChevronsLeft className={cn("transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Ciutkan"}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="flex items-center gap-2 font-semibold"><LogoMark /> {appName}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X /></Button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {credits !== null && (
              <Link href="/app/usage" className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-sm sm:flex hover:bg-accent">
                <Coins className="size-4 text-primary" />
                <span className="font-medium tabular-nums">{credits}</span>
                <span className="text-muted-foreground">{t.common.credits}</span>
              </Link>
            )}
            {planName && <span className="hidden rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground md:inline">{planName}</span>}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary" aria-label="Menu akun">
                  {user.name.slice(0, 1).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p className="truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/app/settings">{t.nav.settings}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/app/usage">{t.nav.usage}</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action="/auth/signout" method="post">
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full"><LogOut /> {t.common.signOut}</button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // false during SSR/hydration, true on the client: avoids a theme-icon hydration mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Ganti tema">
      {mounted && resolvedTheme === "light" ? <Moon /> : <Sun />}
    </Button>
  );
}
