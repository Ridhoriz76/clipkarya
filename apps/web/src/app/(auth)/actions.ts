"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { checkAppPassword, ensureOwner, isPersonalMode, MIN_APP_PASSWORD_LENGTH } from "@/lib/personal";
import { rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string } | null;

const credentials = z.object({
  email: z.email("Email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/app";
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (isPersonalMode()) return personalSignInAction(_, form);
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Email not confirmed" ? "Email belum dikonfirmasi. Cek kotak masuk Anda." : "Email atau kata sandi salah." };
  redirect(safeNext(form.get("next")));
}

/** Personal mode: a single password unlocks the built-in owner account. */
export async function personalSignInAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isPersonalMode()) return { error: "Mode pribadi tidak aktif." };
  if ((process.env.APP_PASSWORD ?? "").length < MIN_APP_PASSWORD_LENGTH)
    return { error: `APP_PASSWORD terlalu pendek (minimal ${MIN_APP_PASSWORD_LENGTH} karakter). Ubah di pengaturan server.` };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await rateLimit(ip, "login", 10, 15 * 60);
  } catch {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }
  const password = form.get("password");
  if (typeof password !== "string" || !checkAppPassword(password)) return { error: "Kata sandi salah." };
  const creds = await ensureOwner();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) return { error: "Gagal masuk. Periksa konfigurasi Supabase." };
  redirect(safeNext(form.get("next")));
}

export async function signUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (isPersonalMode()) return { error: "Pendaftaran dinonaktifkan." };
  const parsed = credentials.extend({ fullName: z.string().trim().min(1, "Nama wajib diisi.").max(100) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
    fullName: form.get("fullName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${publicEnv().appUrl}/auth/callback?next=/app` },
  });
  if (error) return { error: error.message.includes("registered") ? "Email sudah terdaftar." : "Pendaftaran gagal. Coba lagi." };
  if (data.session) redirect("/app");
  return { message: "Cek email Anda untuk mengonfirmasi akun." };
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (isPersonalMode()) return { error: "Tidak tersedia dalam mode pribadi." };
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Email tidak valid." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${publicEnv().appUrl}/auth/callback?next=/reset-password` });
  // Same response whether or not the account exists (no account enumeration).
  return { message: "Jika email terdaftar, tautan reset kata sandi telah dikirim." };
}

export async function resetPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const pw = z.string().min(8, "Kata sandi minimal 8 karakter.").safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0]?.message };
  if (form.get("password") !== form.get("confirm")) return { error: "Konfirmasi kata sandi tidak sama." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: "Sesi reset tidak valid atau kedaluwarsa. Minta tautan baru." };
  redirect("/app");
}
