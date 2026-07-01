import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session and gates the app to a single email.
// Safety: if Supabase isn't configured (no env vars), it lets everything through
// so a deploy without the vars set never breaks the site.
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const allowed = process.env.ALLOWED_EMAIL;
  // Auth is opt-in: the gate only activates once you set ALLOWED_EMAIL. Blank it
  // (or leave Supabase unset) and the whole app is open — nothing to block testing.
  if (!url || !key || !allowed) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");

  // Not signed in → send to login.
  if (!user && !isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  // Signed in but not the allowed email → block.
  if (user && user.email?.toLowerCase() !== allowed.toLowerCase()) {
    await supabase.auth.signOut();
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("error", "not_allowed");
    return NextResponse.redirect(redirect);
  }

  return response;
}
