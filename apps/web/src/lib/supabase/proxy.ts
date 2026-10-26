import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"];
const AUTH_PAGES = ["/login", "/signup"];
/** Personal mode (APP_PASSWORD set): no landing page, sign-up or email password reset. */
const PERSONAL_HIDDEN = ["/", "/signup", "/forgot-password", "/reset-password"];

/** Refresh the Supabase session cookie on each request and gate protected routes (optimistic check). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (process.env.APP_PASSWORD && PERSONAL_HIDDEN.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  // Not in personal mode: there a signed-in non-owner must still reach /login (avoids a redirect loop).
  if (signedIn && !process.env.APP_PASSWORD && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
