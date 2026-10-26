import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Kata sandi baru" };

export default function ResetPasswordPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
      <h1 className="text-xl font-semibold">Buat kata sandi baru</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Masukkan kata sandi baru Anda.</p>
      <AuthForm
        action={resetPasswordAction}
        submitLabel="Simpan kata sandi"
        fields={[
          { name: "password", label: "Kata sandi baru", type: "password", autoComplete: "new-password" },
          { name: "confirm", label: "Ulangi kata sandi", type: "password", autoComplete: "new-password" },
        ]}
      />
    </div>
  );
}
