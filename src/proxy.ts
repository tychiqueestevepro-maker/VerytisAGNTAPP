import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Execute next-intl middleware first for non-api routes
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  
  let response = isApi ? NextResponse.next({ request }) : intlMiddleware(request);

  // Set up Supabase with the response from next-intl
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Only create a new response if next-intl didn't return one (it always does, but just in case)
          if (!response) {
            response = NextResponse.next({ request });
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Rafraîchit la session (obligatoire — ne pas supprimer)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Extract path without locale for auth checks
  const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, "") || "/";
  const locale = pathname.match(/^\/(en|fr)/)?.[1] || routing.defaultLocale;

  // Routes publiques
  const isPublic = pathWithoutLocale === "/login" || pathWithoutLocale.startsWith("/api/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (user && pathWithoutLocale === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
