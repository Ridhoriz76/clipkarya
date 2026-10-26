import type { Metadata } from "next";
import { Mail } from "lucide-react";

export const metadata: Metadata = { title: "Kontak" };

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Kontak</h1>
      <p className="mt-3 text-muted-foreground">Ada pertanyaan, masukan, atau permintaan penghapusan data? Hubungi kami.</p>
      <a href={`mailto:${email}`} className="mt-8 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent">
        <Mail className="size-4 text-primary" /> {email}
      </a>
    </div>
  );
}
