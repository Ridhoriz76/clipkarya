import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
      <h1 className="text-xl font-semibold">Reset kata sandi</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Kami akan mengirim tautan untuk membuat kata sandi baru.</p>
      <AuthForm action={forgotPasswordAction} submitLabel="Kirim tautan" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} />
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">← Kembali ke halaman masuk</Link>
      </p>
    </div>
  );
}
