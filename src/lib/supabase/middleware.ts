import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that must stay public: the login/auth flow and the static legal pages
// Twilio reviews for toll-free registration.
const PUBLIC_PAGES = ["/login", "/auth", "/opt-in", "/terms", "/privacy"];

// API routes that authenticate themselves (webhook secret, cron secret, ingest
// bearer). External services call these, so they bypass the session gate — each
// one MUST fail closed on its own secret.
const SELF_AUTHED_API = [
  "/api/telegram", // x-telegram-bot-api-secret-token (incl. /setup)
  "/api/sms", // Twilio signature + phone allowlist
  "/api/brief", // CRON_SECRET
  "/api/nudge", // CRON_SECRET
  "/api/notify", // TELEGRAM_SECRET_TOKEN
  "/api/knowledge/ingest", // KNOWLEDGE_INGEST_SECRET
];

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

// Gate the app to a single email. Pages redirect to /login; API routes get JSON
// 401/503 so client fetches fail loudly instead of redirecting into HTML.
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api");

  if (!isApi && startsWithAny(path, PUBLIC_PAGES)) {
    return NextResponse.next({ request });
  }
  if (isApi && startsWithAny(path, SELF_AUTHED_API)) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const allowed = process.env.ALLOWED_EMAIL;

  // Not fully configured: open in local dev so `npm run dev` works without
  // secrets, CLOSED in production. (The old fail-open default here is exactly
  // how the task list and profile ended up publicly readable.)
  if (!url || !key || !allowed) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next({ request });
    }
    if (isApi) {
      return NextResponse.json(
        {
          error:
            "Auth not configured — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ALLOWED_EMAIL.",
        },
        { status: 503 }
      );
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("error", "not_configured");
    return NextResponse.redirect(redirect);
  }

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

  const authedOk =
    user != null && user.email?.toLowerCase() === allowed.toLowerCase();

  if (!authedOk) {
    // Signed in as the wrong account → drop the session before bouncing.
    if (user) await supabase.auth.signOut();
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    if (user) redirect.searchParams.set("error", "not_allowed");
    return NextResponse.redirect(redirect);
  }

  return response;
}
