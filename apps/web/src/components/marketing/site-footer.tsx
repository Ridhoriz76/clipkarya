import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { APP_NAME } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Workflow video pendek berbasis AI untuk kreator, marketer, dan agensi di Indonesia.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Produk</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/#fitur" className="hover:text-foreground">Fitur</Link></li>
            <li><Link href="/#faq" className="hover:text-foreground">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Perusahaan</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/terms" className="hover:text-foreground">Syarat Layanan</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Kebijakan Privasi</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">Kontak</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. Semua hak dilindungi.
      </div>
    </footer>
  );
}
