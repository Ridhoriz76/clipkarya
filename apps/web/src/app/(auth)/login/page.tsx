import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { isPersonalMode } from "@/lib/personal";
import { personalSignInAction, signInAction } from "../actions";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (isPersonalMode()) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-xl font-semibold">Masuk</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Masukkan kata sandi aplikasi.</p>
        <AuthForm
          action={personalSignInAction}
          submitLabel="Masuk"
          hidden={{ next: next ?? "/app" }}
          fields={[{ name: "password", label: "Kata sandi", type: "password", autoComplete: "current-password" }]}
        />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
      <h1 className="text-xl font-semibold">Masuk</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Selamat datang kembali.</p>
      {error && <p className="mb-4 text-sm text-destructive">Tautan tidak valid atau kedaluwarsa.</p>}
      <AuthForm
        action={signInAction}
        submitLabel="Masuk"
        hidden={{ next: next ?? "/app" }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "nama@email.com" },
          { name: "password", label: "Kata sandi", type: "password", autoComplete: "current-password" },
        ]}
      />
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">Lupa kata sandi?</Link>
        <Link href="/signup" className="text-primary hover:underline">Buat akun</Link>
      </div>
    </div>
  );
}
