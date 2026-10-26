import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";

const body = z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  locale: z.enum(["id", "en"]).optional(),
});

export const PATCH = withAuth(async ({ req, userId, supabase }) => {
  const b = await parseBody(req, body);
  const { error } = await supabase.from("profiles").update(b).eq("id", userId);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
