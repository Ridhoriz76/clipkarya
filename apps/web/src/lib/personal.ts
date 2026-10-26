import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Personal (single-user) mode: enabled by setting APP_PASSWORD. There is no sign-up;
 * one built-in owner account is unlocked with that password. Supabase Auth and RLS stay
 * in place underneath: after the password check (server-side only) we sign in as the
 * owner with a secret derived from APP_PASSWORD, so the session is a normal Supabase one.
 */
export function isPersonalMode(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export const MIN_APP_PASSWORD_LENGTH = 8;

export function ownerEmail(): string {
  return process.env.OWNER_EMAIL?.trim() || "owner@example.com";
}

/** Constant-time comparison (hashing first makes the lengths equal). */
export function checkAppPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The owner's real Supabase password: derived from APP_PASSWORD and the service-role key,
 * so it is never stored anywhere and changes whenever APP_PASSWORD changes.
 */
function ownerSecret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createHmac("sha256", key).update(`clipkarya-owner:${process.env.APP_PASSWORD}`).digest("base64url");
}

/** Create the owner account on first login (as admin), or re-sync its password. Returns sign-in credentials. */
export async function ensureOwner(): Promise<{ email: string; password: string }> {
  const admin = createAdminClient();
  const email = ownerEmail();
  const password = ownerSecret();

  let id: string | null = null;
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle<{ id: string }>();
  if (profile) {
    id = profile.id;
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) throw new Error(`owner update: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: process.env.OWNER_NAME?.trim() || "Pemilik" },
    });
    if (error || !data.user) throw new Error(`owner create: ${error?.message}`);
    id = data.user.id;
  }
  await admin.from("profiles").update({ role: "admin" }).eq("id", id);
  return { email, password };
}

/** In personal mode only the owner account may use the app, even if other Supabase users exist. */
export function isAllowedUser(email: string | null | undefined): boolean {
  return !isPersonalMode() || (email ?? "").toLowerCase() === ownerEmail().toLowerCase();
}
