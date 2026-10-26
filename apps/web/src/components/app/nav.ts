import {
  BarChart3,
  BookOpen,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  PlusCircle,
  Settings,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { FREE_MODE } from "@/lib/env";
import type { Dictionary } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export function navItems(t: Dictionary, isAdmin: boolean): NavItem[][] {
  const main: NavItem[] = [
    { href: "/app", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/app/create", label: t.nav.create, icon: PlusCircle },
    { href: "/app/projects", label: t.nav.projects, icon: FolderKanban },
    { href: "/app/tools", label: t.nav.tools, icon: Sparkles },
    { href: "/app/brand-kit", label: t.nav.brandKit, icon: Palette },
    { href: "/app/templates", label: t.nav.templates, icon: LayoutTemplate },
  ];
  const account: NavItem[] = [
    { href: "/app/usage", label: FREE_MODE ? t.nav.usageFree : t.nav.usage, icon: FREE_MODE ? BarChart3 : CreditCard },
    { href: "/app/settings", label: t.nav.settings, icon: Settings },
    { href: "/app/help", label: t.nav.help, icon: BookOpen },
  ];
  if (isAdmin) account.push({ href: "/app/admin", label: t.nav.admin, icon: Shield });
  return [main, account];
}
