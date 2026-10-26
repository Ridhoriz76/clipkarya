import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/personal";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Wrap a route handler: authenticates the caller and converts errors to safe JSON responses. */
export function withAuth<Ctx>(
  handler: (args: { req: Request; ctx: Ctx; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user || !isAllowedUser(data.user.email)) throw new ApiError(401, "Silakan masuk terlebih dahulu.", "unauthorized");
      return await handler({ req, ctx, userId: data.user.id, supabase });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) return json({ error: err.message, code: err.code, ...err.extra }, err.status);
  if (err instanceof z.ZodError) return json({ error: "Input tidak valid.", code: "invalid_input", issues: z.flattenError(err).fieldErrors }, 400);
  console.error("[api] unhandled", err);
  return json({ error: "Terjadi kesalahan pada server.", code: "internal" }, 500);
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Body JSON tidak valid.", "invalid_json");
  }
  return schema.parse(body);
}

export const uuidParam = z.uuid();
