import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAllowedUser } from "@/lib/personal";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  locale: "id" | "en";
  role: "user" | "admin";
};

/** Verified user (JWT validated by Supabase), or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAllowedUser(data.user.email)) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, full_name, avatar_url, locale, role").eq("id", user.id).single<Profile>();
  return data;
});

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/app");
  return profile;
}
