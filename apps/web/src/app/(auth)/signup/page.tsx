import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { FREE_MODE } from "@/lib/env";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Daftar" };

export default function SignupPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
      <h1 className="text-xl font-semibold">Buat akun</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{FREE_MODE ? "Gratis untuk semua fitur." : "Gratis, dengan kredit awal untuk mencoba."}</p>
      <AuthForm
        action={signUpAction}
        submitLabel="Daftar"
        fields={[
          { name: "fullName", label: "Nama", autoComplete: "name", placeholder: "Nama Anda" },
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "nama@email.com" },
          { name: "password", label: "Kata sandi (min. 8 karakter)", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Dengan mendaftar, Anda menyetujui <Link href="/terms" className="underline">Syarat Layanan</Link> dan <Link href="/privacy" className="underline">Kebijakan Privasi</Link>.
      </p>
      <p className="mt-4 text-sm">
        Sudah punya akun? <Link href="/login" className="text-primary hover:underline">Masuk</Link>
      </p>
    </div>
  );
}
